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

    def test_health_route_validates_public_api_base(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        source = (
            repo_root / "frontend" / "server" / "api" / "health.get.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("useRuntimeConfig", source)
        self.assertIn("public", source)
        self.assertIn("apiBase", source)
        self.assertIn("internalApiBase", source)
        self.assertIn("localhost", source)
        self.assertIn("127.", source)
        self.assertIn("0.0.0.0", source)
        self.assertIn("::1", source)
        self.assertIn("setResponseStatus", source)
        self.assertIn("api_base", source)
        self.assertIn("internal_api_base", source)
        self.assertIn("public_origin", source)

    def test_frontend_uses_railway_safe_runtime_config(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertFalse((repo_root / "frontend" / "vercel.json").exists())
        self.assertIn("provider: 'ipx'", nuxt_config)
        self.assertNotIn("provider: 'vercel'", nuxt_config)
        self.assertNotIn("Vercel", nuxt_config)

    def test_frontend_receives_public_kakao_runtime_config(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        compose = (repo_root / "docker-compose.oci.yml").read_text(encoding="utf-8")
        frontend_block = compose[compose.index("  frontend:"):compose.index("  celery-worker:")]

        self.assertIn(
            "NUXT_PUBLIC_KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID:?KAKAO_CLIENT_ID 필수}",
            frontend_block,
        )
        self.assertIn(
            "NUXT_PUBLIC_KAKAO_REDIRECT_URI=${KAKAO_REDIRECT_URI:?KAKAO_REDIRECT_URI 필수}",
            frontend_block,
        )

    def test_frontend_receives_public_google_and_apple_runtime_config(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        compose = (repo_root / "docker-compose.oci.yml").read_text(encoding="utf-8")
        frontend_block = compose[compose.index("  frontend:"):compose.index("  celery-worker:")]

        expected = (
            "NUXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID 필수}",
            "NUXT_PUBLIC_GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:?GOOGLE_REDIRECT_URI 필수}",
            "NUXT_PUBLIC_APPLE_CLIENT_ID=${APPLE_CLIENT_ID:?APPLE_CLIENT_ID 필수}",
            "NUXT_PUBLIC_APPLE_REDIRECT_URI=${APPLE_REDIRECT_URI:-https://maeil1dok.app/auth/apple/callback}",
        )
        for value in expected:
            self.assertIn(value, frontend_block)

    def test_frontend_sentry_is_configured_without_committed_dsn(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )
        package_json = (repo_root / "frontend" / "package.json").read_text(
            encoding="utf-8",
        )
        env_example = (repo_root / "frontend" / ".env.example").read_text(
            encoding="utf-8",
        )
        sentry_client = (repo_root / "frontend" / "sentry.client.config.ts").read_text(
            encoding="utf-8",
        )
        sentry_server = (repo_root / "frontend" / "sentry.server.config.ts").read_text(
            encoding="utf-8",
        )
        runbook = (repo_root / "docs" / "railway-migration-runbook.md").read_text(
            encoding="utf-8",
        )

        self.assertIn('"@sentry/nuxt": "^10.58.0"', package_json)
        self.assertIn("'@sentry/nuxt/module'", nuxt_config)
        self.assertIn("sourcemap:", nuxt_config)
        self.assertIn("client: 'hidden'", nuxt_config)
        self.assertIn("sentry:", nuxt_config)
        self.assertIn("org: process.env.SENTRY_ORG", nuxt_config)
        self.assertIn("project: process.env.SENTRY_PROJECT", nuxt_config)
        self.assertIn("authToken: process.env.SENTRY_AUTH_TOKEN", nuxt_config)
        self.assertIn("filesToDeleteAfterUpload", nuxt_config)
        self.assertIn("dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || ''", nuxt_config)
        self.assertIn("environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT", nuxt_config)
        self.assertIn(
            "release: process.env.NUXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA",
            nuxt_config,
        )
        self.assertIn("tracesSampleRate: parseNuxtPublicSentryTracesSampleRate()", nuxt_config)
        for config_source in (nuxt_config, sentry_client, sentry_server):
            self.assertNotIn("sentry.io", config_source)
            self.assertNotIn("___PUBLIC_DSN___", config_source)
        for sentry_config in (sentry_client, sentry_server):
            self.assertIn("import * as Sentry from '@sentry/nuxt'", sentry_config)
            self.assertIn("Sentry.init", sentry_config)

        self.assertIn("useRuntimeConfig", sentry_client)
        self.assertIn("if (config.public.sentry.dsn)", sentry_client)
        self.assertIn("dsn: config.public.sentry.dsn", sentry_client)
        self.assertIn("tracesSampleRate: config.public.sentry.tracesSampleRate", sentry_client)
        self.assertNotIn("useRuntimeConfig", sentry_server)
        self.assertNotIn("#imports", sentry_server)
        self.assertIn("process.env.SENTRY_DSN || process.env.NUXT_PUBLIC_SENTRY_DSN", sentry_server)
        self.assertIn("if (sentryDsn)", sentry_server)
        self.assertIn("dsn: sentryDsn", sentry_server)
        self.assertIn("process.env.SENTRY_RELEASE || process.env.NUXT_PUBLIC_SENTRY_RELEASE", sentry_server)
        self.assertIn("process.env.SENTRY_TRACES_SAMPLE_RATE", sentry_server)

        env_example_fragments = (
            "NUXT_PUBLIC_SENTRY_DSN=",
            "NUXT_PUBLIC_SENTRY_ENVIRONMENT=",
            "NUXT_PUBLIC_SENTRY_RELEASE=",
            "NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=",
            "SENTRY_ORG=",
            "SENTRY_PROJECT=maeil1dok-frontend",
            "SENTRY_AUTH_TOKEN=",
        )
        for fragment in env_example_fragments:
            self.assertIn(fragment, env_example)

        runbook_fragments = (
            "NUXT_PUBLIC_SENTRY_DSN=",
            "NUXT_PUBLIC_SENTRY_ENVIRONMENT=production",
            "NUXT_PUBLIC_SENTRY_RELEASE=",
            "NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1",
            "SENTRY_ORG=",
            "SENTRY_PROJECT=maeil1dok-frontend",
            "SENTRY_AUTH_TOKEN=",
        )
        for fragment in runbook_fragments:
            self.assertIn(fragment, runbook)

    def test_frontend_sets_safe_cache_headers_for_public_assets(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/**'", nuxt_config)
        self.assertIn("'cache-control': 'no-store'", nuxt_config)
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

    def test_stale_bible_search_entry_asset_redirects_to_fresh_route(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        stale_entry = repo_root / "frontend" / "public" / "_nuxt" / "CNIoT2Nz.js"

        source = stale_entry.read_text(encoding="utf-8")

        self.assertIn("location.pathname === '/bible/search'", source)
        self.assertIn("location.replace('/bible/search/'", source)

    def test_bible_page_html_is_not_edge_cached(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        nuxt_config = (repo_root / "frontend" / "nuxt.config.ts").read_text(
            encoding="utf-8",
        )

        self.assertIn("'/bible'", nuxt_config)
        self.assertIn("'/bible/'", nuxt_config)
        self.assertIn("'cache-control': 'no-store'", nuxt_config)


class BuildMarkerCommitPlumbingTest(unittest.TestCase):
    """The deployed web marker must carry a real commit, not `unknown`.

    `frontend/scripts/write-build-marker.mjs` reads `GITHUB_SHA`/`COMMIT_SHA` and
    falls back to `git rev-parse`. The production web image has none of the three:
    CI rsyncs the tree without `.git` and the build runs inside Docker on the VM.
    The marker therefore shipped as `unknown`, and the shell OTA gate
    (`mobile/scripts/publish-ota.mjs --requires-web`) refuses an unknown marker --
    so the ordering guarantee it exists to enforce was unenforceable in production.

    The commit has to be threaded build-arg -> image env -> build script.
    """

    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[1]

    def test_dockerfile_accepts_and_exports_the_commit_before_building(self) -> None:
        source = (self.repo_root / "frontend" / "Dockerfile.oci").read_text(encoding="utf-8")

        self.assertIn("ARG COMMIT_SHA", source)
        self.assertIn("ENV COMMIT_SHA", source)
        # Order matters: an ENV declared after the build cannot reach the script.
        self.assertLess(source.index("ENV COMMIT_SHA"), source.index("RUN npm run build"))

    def test_compose_passes_the_commit_into_the_frontend_image_build(self) -> None:
        source = (self.repo_root / "docker-compose.oci.yml").read_text(encoding="utf-8")
        frontend_block = source[source.index("  frontend:"):]

        self.assertIn("COMMIT_SHA", frontend_block.split("celery-worker")[0])

    def test_ci_supplies_the_commit_to_the_remote_build(self) -> None:
        source = (self.repo_root / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

        self.assertIn("COMMIT_SHA", source)
        self.assertIn("github.sha", source)
