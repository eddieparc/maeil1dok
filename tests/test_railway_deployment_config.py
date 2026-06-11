from __future__ import annotations

import subprocess
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
            "backend-worker": repo_root / "railway" / "backend.worker.toml",
            "backend-beat": repo_root / "railway" / "backend.beat.toml",
            "frontend": repo_root / "railway" / "frontend.toml",
        }
        configs = {name: self._load_toml(path) for name, path in services.items()}

        self.assertEqual(configs["backend-web"]["build"]["builder"], "DOCKERFILE")
        self.assertEqual(configs["backend-web"]["build"]["dockerfilePath"], "backend/Dockerfile")
        self.assertEqual(configs["backend-web"]["deploy"]["healthcheckPath"], "/admin/login/")
        self.assertEqual(configs["backend-web"]["deploy"]["restartPolicyType"], "ON_FAILURE")

        self.assertEqual(
            configs["backend-worker"]["deploy"]["startCommand"],
            "celery -A config worker -l info",
        )
        self.assertEqual(
            configs["backend-beat"]["deploy"]["startCommand"],
            "celery -A config beat -l info",
        )
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

    def _load_toml(self, path: Path) -> dict[str, Any]:
        script = (
            "import json;"
            "import sys;"
            "import tomllib;"
            "print(json.dumps(tomllib.load(open(sys.argv[1], 'rb'))))"
        )
        result = subprocess.run(
            ["python3", "-c", script, str(path)],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        data = __import__("json").loads(result.stdout)
        self.assertIsInstance(data, dict)
        return data
