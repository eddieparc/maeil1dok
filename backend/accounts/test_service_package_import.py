import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase


class AccountsServicePackageImportTest(SimpleTestCase):
    def test_importing_service_package_does_not_require_app_registry(self) -> None:
        backend_directory = Path(__file__).resolve().parents[1]
        environment = {
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "config.test_settings",
        }

        result = subprocess.run(
            [sys.executable, "-c", "import accounts.services"],
            cwd=backend_directory,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
