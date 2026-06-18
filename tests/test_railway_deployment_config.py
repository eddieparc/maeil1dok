from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path
from typing import Any


class RailwayDeploymentConfigTest(unittest.TestCase):
    def test_defines_railway_services_without_render_artifacts(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]

        self.assertFalse((repo_root / "render.yaml").exists())
        self.assertFalse((repo_root / "docs" / "render-migration-runbook.md").exists())
        self.assertFalse((repo_root / "tests" / "test_render_blueprint.py").exists())
        self.assertFalse((repo_root / "tests" / "test_frontend_render_config.py").exists())

        services = {
            "backend-web": repo_root / "railway" / "backend.web.toml",
            "backend-beat": repo_root / "railway" / "backend.beat.toml",
            "backend-backup": repo_root / "railway" / "backend.backup.toml",
            "frontend": repo_root / "railway" / "frontend.toml",
        }
        configs = {name: self._load_toml(path) for name, path in services.items()}

        self.assertEqual(configs["backend-web"]["build"]["builder"], "DOCKERFILE")
        self.assertEqual(configs["backend-web"]["build"]["dockerfilePath"], "Dockerfile")
        self.assertEqual(configs["backend-web"]["deploy"]["healthcheckPath"], "/admin/login/")
        self.assertEqual(configs["backend-web"]["deploy"]["restartPolicyType"], "ON_FAILURE")

        self.assertEqual(configs["backend-beat"]["build"]["dockerfilePath"], "Dockerfile.beat")
        self.assertEqual(configs["backend-beat"]["deploy"]["cronSchedule"], "0,30 15-20 * * 0-5")
        self.assertEqual(configs["backend-backup"]["build"]["dockerfilePath"], "Dockerfile.backup")
        self.assertEqual(configs["backend-backup"]["deploy"]["cronSchedule"], "0 18 * * *")
        self.assertIn("railway/backend.web.toml", configs["backend-web"]["build"]["watchPatterns"])
        self.assertIn("railway/frontend.toml", configs["frontend"]["build"]["watchPatterns"])
        for config in configs.values():
            regions = config["deploy"]["multiRegionConfig"]
            self.assertEqual(regions, {"asia-southeast1-eqsg3a": {"numReplicas": 1}})
        self.assertIn('CMD ["python", "manage.py", "generate_hasena_summary_once"]', (repo_root / "backend" / "Dockerfile.beat").read_text(encoding="utf-8"))
        self.assertIn("mysql.sql.gz.sha256", (repo_root / "backend" / "scripts" / "railway_mysql_backup.sh").read_text(encoding="utf-8"))
        self.assertEqual(configs["frontend"]["build"]["builder"], "RAILPACK")
        self.assertEqual(configs["frontend"]["build"]["buildCommand"], "npm ci && npm run build")
        self.assertEqual(configs["frontend"]["deploy"]["startCommand"], "npm run start")

    def test_runbook_contains_turnkey_cutover_and_external_handoff(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        runbook = (repo_root / "docs" / "railway-migration-runbook.md").read_text(
            encoding="utf-8",
        )

        required_fragments = (
            "railway add --database mysql",
            "railway add --database redis",
            "mysqldump",
            "sha256sum",
            "mysql --host",
            "Final cutover",
            "DNS",
            "OAuth callback",
            "Do not delete the source Docker volumes",
        )
        for fragment in required_fragments:
            self.assertIn(fragment, runbook)

    def test_runbook_documents_cloudflare_cutover_without_www(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        runbook = (repo_root / "docs" / "railway-migration-runbook.md").read_text(
            encoding="utf-8",
        )

        required_fragments = (
            "Cloudflare DNS",
            "maeil1dok.app      CNAME 3brjtmda.up.railway.app",
            "api.maeil1dok.app  CNAME jj9xe8wf.up.railway.app",
            "www.maeil1dok.app is intentionally out of scope",
            "NUXT_PUBLIC_API_BASE=https://api.maeil1dok.app",
        )
        for fragment in required_fragments:
            self.assertIn(fragment, runbook)

    def test_runbook_documents_auto_deploy_backup_and_shutdown_contracts(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        runbook = (repo_root / "docs" / "railway-migration-runbook.md").read_text(
            encoding="utf-8",
        )

        required_fragments = (
            "Railway Auto Deploy",
            "GitHub repo",
            "Branch: `main`",
            "Do not deploy service-root upload bundles",
            "Scheduled Backups",
            "sha256sum -c",
            "Old Stack Shutdown",
            "docker stop maeil1dok_backend maeil1dok_celery_worker maeil1dok_celery_beat",
            "Do not stop maeil1dok_db until final Railway counts match",
        )
        for fragment in required_fragments:
            self.assertIn(fragment, runbook)

    def _load_toml(self, path: Path) -> dict[str, Any]:
        script = (
            "import json;"
            "import sys;"
            "import tomllib;"
            "print(json.dumps(tomllib.load(open(sys.argv[1], 'rb'))))"
        )
        result = subprocess.run(
            [sys.executable, "-c", script, str(path)],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        data = __import__("json").loads(result.stdout)
        self.assertIsInstance(data, dict)
        return data
