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

    def test_frontend_uses_railway_safe_runtime_config(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertFalse((repo_root / "frontend" / "vercel.json").exists())
        self.assertIn("provider: 'ipx'", nuxt_config)
        self.assertNotIn("provider: 'vercel'", nuxt_config)
        self.assertNotIn("Vercel", nuxt_config)

    def test_frontend_sets_safe_cache_headers_for_public_assets(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/_nuxt/**'", nuxt_config)
        self.assertIn("max-age=31536000, immutable", nuxt_config)
        self.assertIn("s-maxage=300, stale-while-revalidate=86400", nuxt_config)
        self.assertIn("'/api/**'", nuxt_config)
        self.assertIn("no-store", nuxt_config)

    def test_hasena_page_html_is_not_edge_cached(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/hasena'", nuxt_config)
        self.assertIn("'cache-control': 'no-store'", nuxt_config)

    def test_bible_search_page_html_is_not_edge_cached(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/bible/search'", nuxt_config)
        self.assertIn("'/bible/search/'", nuxt_config)
        self.assertIn("'cache-control': 'no-store'", nuxt_config)

    def test_bible_page_html_is_not_edge_cached(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/bible'", nuxt_config)
        self.assertIn("'/bible/'", nuxt_config)
        self.assertIn("'cache-control': 'no-store'", nuxt_config)
