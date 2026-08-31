from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


class EntrypointTest(unittest.TestCase):
    def test_uses_configured_database_host_and_port_for_default_web_server(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            result, log = self._run_entrypoint(
                Path(temp_dir),
                {
                    "DB_HOST": "maeil1dok-mysql",
                    "DB_PORT": "3306",
                    "DEBUG": "false",
                    "PORT": "8123",
                },
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("nc -z maeil1dok-mysql 3306", log)
        self.assertIn("python manage.py migrate --noinput", log)
        self.assertIn("python manage.py collectstatic --noinput", log)
        self.assertIn(
            "gunicorn config.wsgi:application --config config/gunicorn.py "
            "--bind 0.0.0.0:8123 --workers 3 --timeout 60",
            log,
        )

    def test_executes_custom_service_command_after_optional_startup_tasks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            result, log = self._run_entrypoint(
                Path(temp_dir),
                {
                    "DB_HOST": "maeil1dok-mysql",
                    "DB_PORT": "3306",
                    "DEBUG": "false",
                    "RUN_MIGRATIONS": "false",
                    "RUN_COLLECTSTATIC": "false",
                },
                "celery",
                "-A",
                "config",
                "worker",
                "-l",
                "info",
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("python manage.py migrate --noinput", log)
        self.assertNotIn("python manage.py collectstatic --noinput", log)
        self.assertIn("celery -A config worker -l info", log)
        self.assertNotIn("gunicorn config.wsgi:application", log)

    def _run_entrypoint(
        self,
        temp_path: Path,
        environment: dict[str, str],
        *args: str,
    ) -> tuple[subprocess.CompletedProcess[str], str]:
        repo_root = Path(__file__).resolve().parents[2]
        entrypoint = temp_path / "entrypoint.sh"
        bin_path = temp_path / "bin"
        log_path = temp_path / "commands.log"
        bin_path.mkdir()
        shutil.copy(repo_root / "backend" / "entrypoint.sh", entrypoint)
        entrypoint.chmod(entrypoint.stat().st_mode | stat.S_IXUSR)

        for name in ("nc", "python", "gunicorn", "celery"):
            command = bin_path / name
            command.write_text(
                "#!/bin/sh\n"
                f"printf '{name} %s\\n' \"$*\" >> \"$COMMAND_LOG\"\n"
                "exit 0\n",
                encoding="utf-8",
            )
            command.chmod(command.stat().st_mode | stat.S_IXUSR)

        test_env = os.environ.copy()
        test_env.update(environment)
        test_env["COMMAND_LOG"] = str(log_path)
        test_env["PATH"] = f"{bin_path}{os.pathsep}{test_env['PATH']}"

        result = subprocess.run(
            [str(entrypoint), *args],
            cwd=repo_root / "backend",
            env=test_env,
            text=True,
            capture_output=True,
            check=False,
        )
        log = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
        return result, log
