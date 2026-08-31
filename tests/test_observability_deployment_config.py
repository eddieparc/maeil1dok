from __future__ import annotations

import re
import unittest
from pathlib import Path


class ObservabilityDeploymentConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]
        self.compose = (self.root / "docker-compose.oci.yml").read_text(encoding="utf-8")
        self.workflow = (self.root / ".github" / "workflows" / "ci.yml").read_text(
            encoding="utf-8",
        )
        self.backend_sentry = (
            self.root / "backend" / "config" / "observability.py"
        ).read_text(encoding="utf-8")
        self.nuxt_config = (self.root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )
        self.sentry_server = (
            self.root / "frontend" / "sentry.server.config.ts"
        ).read_text(encoding="utf-8")
        self.frontend_dockerfile = (
            self.root / "frontend" / "Dockerfile.oci"
        ).read_text(encoding="utf-8")
        self.env_example = (self.root / ".env.oci.example").read_text(encoding="utf-8")

    def test_deployed_commit_is_the_single_sentry_release(self) -> None:
        self.assertIn("export COMMIT_SHA=", self.workflow)
        self.assertGreaterEqual(self.compose.count("SENTRY_RELEASE: ${COMMIT_SHA:?"), 2)
        self.assertIn("<<: *web-environment", self.compose)
        self.assertIn("<<: *worker-environment", self.compose)
        self.assertGreaterEqual(
            self.compose.count("<<: *backend-core-environment"),
            3,
        )
        self.assertIn(
            "NUXT_PUBLIC_SENTRY_RELEASE=${COMMIT_SHA:?",
            self.compose,
        )

    def test_dead_railway_release_fallback_is_removed(self) -> None:
        self.assertNotIn("RAILWAY_GIT_COMMIT_SHA", self.backend_sentry)
        self.assertNotIn("RAILWAY_GIT_COMMIT_SHA", self.nuxt_config)
        self.assertNotIn("RAILWAY_GIT_COMMIT_SHA", self.sentry_server)

    def test_frontend_sourcemap_upload_is_fail_closed_and_receipted(self) -> None:
        self.assertIn("sentry_auth_token", self.compose)
        self.assertIn("environment: SENTRY_AUTH_TOKEN", self.compose)
        self.assertIn(
            "--mount=type=secret,id=sentry_auth_token,required=true",
            self.frontend_dockerfile,
        )
        self.assertIn(
            "sentry-cli sourcemaps upload",
            self.frontend_dockerfile,
        )
        for required_flag in ("--release", "--validate", "--wait", "--strict"):
            self.assertIn(required_flag, self.frontend_dockerfile)
        self.assertIn(
            "write-sentry-upload-receipt.mjs",
            self.frontend_dockerfile,
        )
        self.assertIn("SENTRY_AUTH_TOKEN=", self.env_example)
        self.assertIn("SENTRY_ORG=", self.env_example)
        self.assertIn("SENTRY_PROJECT=", self.env_example)

    def test_central_logs_are_retained_on_the_isolated_oci_stack(self) -> None:
        loki_path = self.root / "ops" / "loki" / "config.yml"
        alloy_path = self.root / "ops" / "alloy" / "config.alloy"
        self.assertTrue(loki_path.is_file(), "Loki config must be deployed from the repo")
        self.assertTrue(alloy_path.is_file(), "Alloy config must be deployed from the repo")
        loki = loki_path.read_text(encoding="utf-8")
        alloy = alloy_path.read_text(encoding="utf-8")

        self.assertIn("grafana/loki:3.5.5", self.compose)
        self.assertIn("grafana/alloy:v1.10.2", self.compose)
        self.assertIn(
            "source: ${OCI_DATA_ROOT:-/mnt/data/maeil1dok}/loki",
            self.compose,
        )
        self.assertIn("target: /loki", self.compose)
        self.assertIn("/var/run/docker.sock:/var/run/docker.sock:ro", self.compose)
        self.assertIn("retention_period: 720h", loki)
        self.assertIn("retention_enabled: true", loki)
        self.assertIn('values = ["com.docker.compose.project=maeil1dok"]', alloy)
        self.assertRegex(alloy, r'target_label\s*=\s*"service"')
        self.assertRegex(alloy, r'url\s*=\s*"http://loki:3100/loki/api/v1/push"')

    def test_health_backup_and_logging_alert_probe_is_deployed(self) -> None:
        probe_script = (self.root / "ops" / "probes" / "run.sh").read_text(
            encoding="utf-8"
        )
        backup_script = (self.root / "scripts" / "oci_mysql_backup.sh").read_text(
            encoding="utf-8"
        )

        self.assertIn("alert-probe:", self.compose)
        self.assertIn(
            "DJANGO_HEALTH_URL: https://api.maeil1dok.app/health/",
            self.compose,
        )
        self.assertIn("LOKI_READY_URL: http://loki:3100/ready", self.compose)
        self.assertIn("ALLOY_READY_URL: http://alloy:12345/-/ready", self.compose)
        self.assertIn("last-success.json", backup_script)
        self.assertIn("BACKUP_MAX_AGE_SECONDS", probe_script)
        self.assertIn("https://api.resend.com/emails", probe_script)
        self.assertIn("--canary", probe_script)
        self.assertIn("OPS_ALERT_EMAIL=", self.env_example)
        self.assertIn("alert-probe", self.workflow)

    def test_observability_changes_run_ci_and_trigger_deployment(self) -> None:
        for required_path in (
            "docker-compose.oci.yml",
            "ops/**",
            "scripts/oci_compose.sh",
            "scripts/oci_mysql_backup.sh",
            ".env.oci.example",
        ):
            self.assertGreaterEqual(self.workflow.count(required_path), 2)
        self.assertIn("tests.test_observability_deployment_config", self.workflow)
        self.assertIn("tests.test_ops_alert_probe", self.workflow)
        self.assertIn("steps.filter.outputs.operations", self.workflow)
        self.assertIn("needs.changes.outputs.operations == 'true'", self.workflow)

    def test_backup_receipt_is_published_only_after_optional_upload(self) -> None:
        backup_script = (self.root / "scripts" / "oci_mysql_backup.sh").read_text(
            encoding="utf-8"
        )

        self.assertLess(
            backup_script.index("oci os object put"),
            backup_script.index('mv "$RECEIPT_TMP"'),
        )
        self.assertNotIn('-p"${DUMP_PW}"', backup_script)
        self.assertNotIn('-e MYSQL_PWD="$DUMP_PW"', backup_script)
        self.assertIn('printenv "$1"', backup_script)
        self.assertIn("--env-file", backup_script)
        self.assertIn(".deploy-commit", backup_script)
        self.assertIn("umask 027", backup_script)
        self.assertIn('chmod 2750 "$BACKUP_DIR"', backup_script)
        self.assertIn('chmod 640 "$OUT"', backup_script)

    def test_observability_services_are_least_privilege_and_network_isolated(self) -> None:
        probe_dockerfile = (self.root / "ops" / "probes" / "Dockerfile").read_text(
            encoding="utf-8"
        )
        alloy = (self.root / "ops" / "alloy" / "config.alloy").read_text(
            encoding="utf-8"
        )

        self.assertIn("apk add --no-cache bash", probe_dockerfile)
        self.assertIn("USER 10001:10001", probe_dockerfile)
        self.assertIn("docker-proxy:", self.compose)
        self.assertNotIn(
            "/var/run/docker.sock:/var/run/docker.sock:ro\n"
            "      - ${OCI_DATA_ROOT",
            self.compose,
        )
        self.assertIn('host = "tcp://docker-proxy:2375"', alloy)
        self.assertIn("observability:", self.compose)
        self.assertIn("internal: true", self.compose)
        self.assertNotIn("env_file: .env.oci", self.compose)
        self.assertIn("healthcheck:", self.compose[self.compose.index("alert-probe:") :])
        core_environment = self.compose[
            self.compose.index("x-backend-core-environment:")
            : self.compose.index("x-web-environment:")
        ]
        for unrelated_secret in (
            "GEMINI_API_KEY",
            "YOUTUBE_API_KEY",
            "WEB_PUSH_VAPID_PRIVATE_KEY",
            "RESEND_API_KEY",
            "GOOGLE_CLIENT_SECRET",
        ):
            self.assertNotIn(unrelated_secret, core_environment)

    def test_build_contexts_exclude_environment_secrets(self) -> None:
        for directory in ("backend", "frontend"):
            dockerignore = self.root / directory / ".dockerignore"
            self.assertTrue(dockerignore.is_file())
            self.assertIn(".env*", dockerignore.read_text(encoding="utf-8"))

    def test_public_serving_path_and_alert_delivery_are_deployment_gates(self) -> None:
        probe_script = (self.root / "ops" / "probes" / "run.sh").read_text(
            encoding="utf-8"
        )

        self.assertIn("https://api.maeil1dok.app/health/", probe_script)
        self.assertIn("https://maeil1dok.app/api/health", probe_script)
        self.assertIn("--entrypoint /app/run.sh alert-probe --canary", self.workflow)
        self.assertIn("github.ref == 'refs/heads/main'", self.workflow)

    def test_frontend_receipt_covers_client_and_server_source_maps(self) -> None:
        receipt_script = (
            self.root / "frontend" / "scripts" / "write-sentry-upload-receipt.mjs"
        ).read_text(encoding="utf-8")

        self.assertIn(".output/server", self.frontend_dockerfile)
        self.assertIn("ca-certificates", self.frontend_dockerfile)
        self.assertIn("clientSourceMapCount", receipt_script)
        self.assertIn("serverSourceMapCount", receipt_script)

    def test_external_uptime_deadman_checks_public_routes(self) -> None:
        uptime_path = self.root / ".github" / "workflows" / "uptime.yml"
        self.assertTrue(uptime_path.is_file())
        uptime = uptime_path.read_text(encoding="utf-8")

        self.assertIn("schedule:", uptime)
        self.assertIn("https://api.maeil1dok.app/health/", uptime)
        self.assertIn("https://api.maeil1dok.app/ready/", uptime)
        self.assertIn("https://maeil1dok.app/api/health", uptime)

    def test_deployment_uses_pinned_host_key_and_protects_environment_files(self) -> None:
        self.assertIn(".github/known_hosts.oci", self.workflow)
        self.assertNotIn("ssh-keyscan", self.workflow)
        self.assertIn("chmod 600 .env.oci .env.frontend.oci", self.workflow)
        self.assertIn("CRON_TZ=Asia/Seoul", self.workflow)
        self.assertIn("/etc/cron.d/maeil1dok-backup", self.workflow)
        self.assertIn("install -d -m 2750 -o ubuntu -g 10001", self.workflow)
        self.assertIn(".deploy-commit", self.workflow)
        self.assertIn("chgrp 10001", self.workflow)
        self.assertIn("/var/log/maeil1dok_mysql_backup.log", self.workflow)
        for owned_directory in (
            "/mnt/data/maeil1dok/loki",
            "/mnt/data/maeil1dok/alloy",
            "/mnt/data/maeil1dok/alerts",
        ):
            for line in self.workflow.splitlines():
                if line.strip().startswith("install -d") and owned_directory in line:
                    self.fail(f"{owned_directory} must be provisioned with sudo")

    def test_deployment_seeds_backup_and_waits_for_logging_before_canary(self) -> None:
        marker = "Seed backup and wait for logging readiness"
        canary = "--entrypoint /app/run.sh alert-probe --canary"

        self.assertIn(marker, self.workflow)
        self.assertIn("http://loki:3100/ready", self.workflow)
        self.assertIn("./scripts/oci_mysql_backup.sh", self.workflow)
        self.assertLess(self.workflow.index(marker), self.workflow.index(canary))
        self.assertLess(
            self.workflow.index("./scripts/oci_mysql_backup.sh"),
            self.workflow.index(canary),
        )

    def test_deployment_and_backup_safety_gates_cannot_silently_regress(self) -> None:
        backup_script = (self.root / "scripts" / "oci_mysql_backup.sh").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "needs: [changes, backend-ci, frontend-ci, frontend-e2e, "
            "deployment-config-ci, mobile-ci]",
            self.workflow,
        )
        self.assertIn("!cancelled() && !failure()", self.workflow)
        self.assertIn("Migration drift check", self.workflow)
        self.assertIn("--single-transaction", backup_script)
        self.assertIn('gzip -t "$OUT"', backup_script)

    def test_compose_wrapper_always_loads_deployed_commit(self) -> None:
        wrapper_path = self.root / "scripts" / "oci_compose.sh"
        self.assertTrue(wrapper_path.is_file())
        wrapper = wrapper_path.read_text(encoding="utf-8")
        deploy_doc = (self.root / "DEPLOY.md").read_text(encoding="utf-8")
        observability_doc = (
            self.root / "docs" / "production-observability.md"
        ).read_text(encoding="utf-8")

        self.assertIn(".deploy-commit", wrapper)
        self.assertIn("export COMMIT_SHA", wrapper)
        self.assertIn("exec docker compose", wrapper)
        self.assertIn("./scripts/oci_compose.sh", deploy_doc)
        self.assertIn("./scripts/oci_compose.sh", observability_doc)


if __name__ == "__main__":
    unittest.main()
