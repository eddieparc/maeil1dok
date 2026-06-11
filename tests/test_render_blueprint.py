from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path
from typing import Any


class RenderBlueprintTest(unittest.TestCase):
    def test_defines_expected_production_stack_without_hardcoded_secrets(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        blueprint = self._load_blueprint(repo_root / "render.yaml")

        self.assertEqual(blueprint["previews"], {"generation": "off"})

        services = blueprint["services"]
        by_name = {service["name"]: service for service in services}

        expected_services = {
            "maeil1dok-mysql",
            "maeil1dok-redis",
            "maeil1dok-backend",
            "maeil1dok-celery-worker",
            "maeil1dok-celery-beat",
            "maeil1dok-frontend",
        }
        self.assertEqual(set(by_name), expected_services)

        for service in services:
            self.assertEqual(service["plan"], "standard")

        self.assertEqual(by_name["maeil1dok-mysql"]["type"], "pserv")
        self.assertEqual(by_name["maeil1dok-mysql"]["runtime"], "image")
        self.assertEqual(by_name["maeil1dok-mysql"]["disk"]["mountPath"], "/var/lib/mysql")
        self.assertEqual(by_name["maeil1dok-redis"]["type"], "keyvalue")
        self.assertEqual(by_name["maeil1dok-redis"]["ipAllowList"], [])

        backend_env = self._env_by_key(by_name["maeil1dok-backend"])
        self.assertEqual(
            backend_env["DB_HOST"]["fromService"],
            {"type": "pserv", "name": "maeil1dok-mysql", "property": "host"},
        )
        self.assertEqual(backend_env["DB_PORT"]["value"], "3306")
        self.assertEqual(backend_env["REDIS_URL"]["fromService"]["type"], "keyvalue")
        self.assertEqual(backend_env["CELERY_BROKER_URL"]["fromService"]["type"], "keyvalue")
        self.assertEqual(backend_env["SECRET_KEY"]["sync"], False)
        self.assertNotIn("API_BIBLE_KEY", backend_env)

        frontend_env = self._env_by_key(by_name["maeil1dok-frontend"])
        self.assertEqual(
            frontend_env["NUXT_PUBLIC_API_BASE"]["value"],
            "https://api.maeil1dok.app",
        )
        self.assertEqual(
            frontend_env["NUXT_INTERNAL_API_BASE"]["value"],
            "https://api.maeil1dok.app",
        )
        self.assertEqual(by_name["maeil1dok-frontend"]["rootDir"], "frontend")
        self.assertEqual(by_name["maeil1dok-frontend"]["runtime"], "node")

        for service_name in ("maeil1dok-celery-worker", "maeil1dok-celery-beat"):
            worker_env = self._env_by_key(by_name[service_name])
            self.assertEqual(worker_env["RUN_MIGRATIONS"]["value"], "false")
            self.assertEqual(worker_env["RUN_COLLECTSTATIC"]["value"], "false")
            self.assertNotIn("API_BIBLE_KEY", worker_env)
            for env_var in worker_env.values():
                from_service = env_var.get("fromService")
                if from_service is None:
                    continue
                self.assertNotIn(from_service["type"], {"web", "worker"})

        rendered = (repo_root / "render.yaml").read_text(encoding="utf-8")
        forbidden_literals = (
            "your_",
            "secret_key_here",
            "actual_secret",
            "replace_me",
            "client_secret_value",
        )
        for literal in forbidden_literals:
            self.assertNotIn(literal, rendered.lower())

    def _load_blueprint(self, path: Path) -> dict[str, Any]:
        ruby = (
            "require 'yaml';"
            "require 'json';"
            f"puts JSON.generate(YAML.load_file({json.dumps(str(path))}))"
        )
        result = subprocess.run(
            ["ruby", "-e", ruby],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertIsInstance(data, dict)
        return data

    def _env_by_key(self, service: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return {item["key"]: item for item in service["envVars"]}
