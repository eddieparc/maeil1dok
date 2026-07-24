from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path


class SettingsEnvironmentValidationTest(unittest.TestCase):
    def test_production_settings_fail_closed_when_database_env_is_missing(self) -> None:
        result = self._import_settings_without_database_env("config.settings")

        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("DB_NAME", result.stderr)
        self.assertIn("DB_USER", result.stderr)
        self.assertIn("DB_PASSWORD", result.stderr)
        self.assertIn("DB_HOST", result.stderr)
        self.assertNotIn("db-pass", result.stderr)

    def test_production_settings_error_does_not_leak_present_database_password(self) -> None:
        result = self._import_settings(
            "config.settings",
            {
                "DB_NAME": None,
                "DB_USER": None,
                "DB_PASSWORD": "db-pass",
                "DB_HOST": None,
            },
        )

        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("DB_NAME", result.stderr)
        self.assertIn("DB_USER", result.stderr)
        self.assertIn("DB_HOST", result.stderr)
        self.assertNotIn("DB_PASSWORD", result.stderr)
        self.assertNotIn("db-pass", result.stderr)

    def test_production_settings_import_when_database_env_is_present(self) -> None:
        result = self._import_settings(
            "config.settings",
            {
                "DB_NAME": "maeil_test",
                "DB_USER": "maeil_user",
                "DB_PASSWORD": "db-pass",
                "DB_HOST": "db",
            },
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "db")

    def test_debug_security_defaults_match_django_extraction_behavior(self) -> None:
        result = self._import_settings(
            "config.settings",
            {
                "DEBUG": "true",
                "DB_NAME": "maeil_test",
                "DB_USER": "maeil_user",
                "DB_PASSWORD": "db-pass",
                "DB_HOST": "db",
            },
            script=(
                "print(settings.SECURE_PROXY_SSL_HEADER)\n"
                "print(settings.SECURE_CONTENT_TYPE_NOSNIFF)\n"
            ),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), ["None", "True"])

    def test_test_settings_import_without_database_env(self) -> None:
        result = self._import_settings_without_database_env("config.test_settings")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "django.db.backends.sqlite3")

    def _import_settings_without_database_env(
        self,
        settings_module: str,
    ) -> subprocess.CompletedProcess[str]:
        env = {
            "DB_NAME": None,
            "DB_USER": None,
            "DB_PASSWORD": None,
            "DB_HOST": None,
            # CI 는 TEST_DB_ENGINE=mysql 로 돌지만 이 테스트는 'DB env 없는' 임포트를 검증하므로 제거
            "TEST_DB_ENGINE": None,
        }
        return self._import_settings(settings_module, env)

    def _import_settings(
        self,
        settings_module: str,
        environment: dict[str, str | None],
        script: str | None = None,
    ) -> subprocess.CompletedProcess[str]:
        backend_root = Path(__file__).resolve().parents[1]
        env = os.environ.copy()
        env.update(
            {
                "SECRET_KEY": "test-secret",
                "KAKAO_CLIENT_ID": "test-kakao",
                "KAKAO_REDIRECT_URI": "http://testserver/callback",
                "DJANGO_SETTINGS_MODULE": settings_module,
            }
        )
        for key, value in environment.items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value

        import_script = script or "print(database.get('HOST', database['ENGINE']))\n"
        return subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import importlib, os, sys\n"
                    "try:\n"
                    "    settings = importlib.import_module(os.environ['DJANGO_SETTINGS_MODULE'])\n"
                    "except Exception as exc:\n"
                    "    print(f'{type(exc).__name__}: {exc}', file=sys.stderr)\n"
                    "    raise SystemExit(1)\n"
                    "database = settings.DATABASES['default']\n"
                    f"{import_script}"
                ),
            ],
            cwd=backend_root,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
