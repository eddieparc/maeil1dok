from __future__ import annotations

import unittest
from pathlib import Path


class FrontendDeploymentConfigTest(unittest.TestCase):
    def test_server_api_clients_do_not_fall_back_to_localhost_in_production(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        client_files = (
            repo_root / "frontend" / "app" / "composables" / "useApi.ts",
            repo_root / "frontend" / "app" / "composables" / "useAuthService.ts",
        )

        for path in client_files:
            source = path.read_text(encoding="utf-8")
            self.assertIn("internalApiBase", source)
            self.assertNotIn("http://localhost:8019", source)
