from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path


class BackendCiConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        self.workflow = (repo_root / ".github" / "workflows" / "ci.yml").read_text(
            encoding="utf-8",
        )
        parsed = subprocess.check_output(
            [
                "ruby",
                "-e",
                "require 'yaml'; require 'json'; puts JSON.generate(YAML.load_file(ARGV.fetch(0), aliases: true))",
                str(repo_root / ".github" / "workflows" / "ci.yml"),
            ],
            text=True,
        )
        self.config = json.loads(parsed)

    def test_backend_ci_job_is_defined(self) -> None:
        self.assertIn("backend-ci:", self.workflow)
        self.assertIn("needs.changes.outputs.backend == 'true'", self.workflow)
        self.assertIn("working-directory: backend", self.workflow)

    def test_plan_flow_gate_runs_on_all_active_event_types(self) -> None:
        job = self.config["jobs"]["plan-flow-ci"]
        self.assertEqual(job["needs"], "changes")
        self.assertIn("workflow_dispatch", job["if"])
        self.assertIn("github.event_name == 'push'", job["if"])
        self.assertIn("pull_request.draft == false", job["if"])

    def test_plan_flow_gate_exports_shared_fixture_and_runs_both_stacks(self) -> None:
        job = self.config["jobs"]["plan-flow-ci"]
        steps = job["steps"]
        backend = next(
            step for step in steps if step.get("name") == "Export real plan API fixture"
        )
        mobile = next(
            step
            for step in steps
            if step.get("name") == "Mobile plan flow tests against real API fixture"
        )
        self.assertEqual(backend["run"], "python manage.py test tests.test_plan_read_contract")
        self.assertEqual(backend["working-directory"], "backend")
        self.assertEqual(
            backend["env"]["PLAN_FLOW_FIXTURE_PATH"],
            "${{ runner.temp }}/plan-flow.json",
        )
        self.assertEqual(
            mobile["run"],
            "node --test test/homeScreen.test.cjs test/scheduleScreen.test.cjs test/readerTongdokScreen.test.cjs",
        )
        self.assertEqual(
            mobile["env"]["PLAN_FLOW_FIXTURE_PATH"],
            "${{ runner.temp }}/plan-flow.json",
        )

    def test_deploy_requires_plan_flow_gate_success(self) -> None:
        self.assertIn("plan-flow-ci", self.config["jobs"]["deploy-oci"]["needs"])
        self.assertIn(
            "needs.plan-flow-ci.result == 'success'",
            self.config["jobs"]["deploy-oci"]["if"],
        )

    def test_workflow_expressions_are_validated_before_deployment(self) -> None:
        steps = self.config["jobs"]["deployment-config-ci"]["steps"]
        validator = next(step for step in steps
                         if step.get("name") == "Validate workflow expressions")
        self.assertIn("rhysd/actionlint:1.7.7", validator["run"])
        self.assertIn(".github/workflows/ci.yml", validator["run"])

    def test_backend_test_command_includes_bible_cache(self) -> None:
        self.assertIn(
            "run: python manage.py test accounts todos tests bible_cache",
            self.workflow,
        )

    def test_backend_ci_runs_real_redis_integration_without_skips(self) -> None:
        self.assertIn("redis:", self.workflow)
        self.assertIn("image: redis:7-alpine", self.workflow)
        self.assertIn("REDIS_TEST_URL: redis://127.0.0.1:6379/15", self.workflow)

    def test_stale_backend_test_command_is_absent(self) -> None:
        self.assertNotIn(
            "run: python manage.py test accounts todos tests\n",
            self.workflow,
        )

    def test_workflow_contract_test_triggers_push_ci(self) -> None:
        push_marker = "push:"
        pull_marker = "pull_request:"
        push_index = self.workflow.index(push_marker)
        pull_index = self.workflow.index(pull_marker)
        push_block = self.workflow[push_index:pull_index]
        self.assertIn("tests/test_backend_ci_config.py", push_block)

    def test_workflow_contract_test_triggers_pull_request_ci(self) -> None:
        pull_marker = "pull_request:"
        jobs_marker = "\njobs:"
        pull_index = self.workflow.index(pull_marker)
        jobs_index = self.workflow.index(jobs_marker)
        pull_block = self.workflow[pull_index:jobs_index]
        self.assertIn("tests/test_backend_ci_config.py", pull_block)

    def test_deployment_paths_filter_includes_contract_test(self) -> None:
        filter_marker = "deployment:"
        filter_index = self.workflow.index(filter_marker)
        jobs_after = self.workflow.index("\n  backend-ci:")
        deployment_block = self.workflow[filter_index:jobs_after]
        self.assertIn("tests/test_backend_ci_config.py", deployment_block)

    def test_deployment_lane_runs_backend_contract_test(self) -> None:
        self.assertIn("tests.test_backend_ci_config", self.workflow)

    def test_deploy_rebuilds_and_recreates_celery_services(self) -> None:
        self.assertIn(
            "./scripts/oci_compose.sh build web celery-worker celery-beat frontend",
            self.workflow,
        )
        self.assertIn(
            "./scripts/oci_compose.sh up -d web celery-worker celery-beat frontend cloudflared",
            self.workflow,
        )

    def test_deploy_smoke_checks_backend_readiness(self) -> None:
        self.assertIn("https://api.maeil1dok.app/ready/", self.workflow)
        self.assertIn('[ "$ready" = "200" ]', self.workflow)

    def test_web_is_healthy_before_frontend_rollout(self) -> None:
        health_gate = "./scripts/oci_compose.sh up -d --wait --wait-timeout 240 web"
        frontend_rollout = "./scripts/oci_compose.sh up -d web celery-worker celery-beat frontend"

        self.assertLess(
            self.workflow.index(health_gate),
            self.workflow.index(frontend_rollout),
        )

    def test_deploy_preserves_other_projects_images(self) -> None:
        self.assertNotIn("docker image prune", self.workflow)


if __name__ == "__main__":
    unittest.main()
