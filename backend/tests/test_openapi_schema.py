import difflib
import io
import tempfile
from contextlib import redirect_stderr
from pathlib import Path

import yaml
from django.conf import settings
from django.core.management import call_command
from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator

from tests.api_characterization import enumerate_routes


SCHEMA_PATH = Path(settings.BASE_DIR) / "schema.yml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


class OpenApiSchemaTest(SimpleTestCase):
    maxDiff = None

    def test_committed_schema_matches_generated_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            generated_path = Path(directory) / "schema.yml"
            with redirect_stderr(io.StringIO()):
                call_command(
                    "spectacular",
                    file=str(generated_path),
                    validate=True,
                    stdout=io.StringIO(),
                    stderr=io.StringIO(),
                )
            generated = generated_path.read_text(encoding="utf-8")

        committed = SCHEMA_PATH.read_text(encoding="utf-8")
        if committed == generated:
            return

        diff = "".join(
            difflib.unified_diff(
                committed.splitlines(keepends=True),
                generated.splitlines(keepends=True),
                fromfile=str(SCHEMA_PATH),
                tofile="freshly generated schema",
                n=3,
            )
        )
        self.fail(
            "OpenAPI schema drift detected. Regenerate with "
            "`python manage.py spectacular --file schema.yml --validate`.\n"
            f"{diff}"
        )

    def test_every_api_url_leaf_is_represented(self):
        schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8"))
        schema_paths = set(schema["paths"])

        generator = SchemaGenerator()
        generator._initialise_endpoints()
        discovered_paths = {
            path.replace("{pk}", "{id}")
            for path, _, _, _ in generator.endpoints
        }
        endpoint_callbacks = {callback for _, _, _, callback in generator.endpoints}

        api_routes = [
            route for route in enumerate_routes() if route.pattern.startswith("api/")
        ]
        format_aliases = [
            route for route in api_routes if "format" in route.pattern
        ]
        uncovered = [
            route.pattern
            for route in api_routes
            if route.name != "api-root" and route.callback not in endpoint_callbacks
        ]

        self.assertEqual(216, len(api_routes))
        self.assertEqual(22, len(format_aliases))
        self.assertEqual([], uncovered)
        self.assertEqual(discovered_paths | {"/api/v1/todos/"}, schema_paths)
        self.assertEqual(194, len(schema_paths))

        operation_count = sum(
            method in HTTP_METHODS
            for path_item in schema["paths"].values()
            for method in path_item
        )
        self.assertEqual(226, operation_count)

    def test_duplicate_account_prefixes_have_one_deprecated_alias(self):
        schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8"))
        paths = schema["paths"]
        account_paths = {
            path.removeprefix("/api/v1/accounts/"): path_item
            for path, path_item in paths.items()
            if path.startswith("/api/v1/accounts/")
        }
        auth_paths = {
            path.removeprefix("/api/v1/auth/"): path_item
            for path, path_item in paths.items()
            if path.startswith("/api/v1/auth/")
        }

        self.assertEqual(set(account_paths), set(auth_paths))
        self.assertEqual(47, len(account_paths))
        for suffix in account_paths:
            for method in HTTP_METHODS:
                account_operation = account_paths[suffix].get(method)
                auth_operation = auth_paths[suffix].get(method)
                if account_operation is None and auth_operation is None:
                    continue
                self.assertIsNotNone(account_operation)
                self.assertIsNotNone(auth_operation)
                self.assertNotEqual(
                    bool(account_operation.get("deprecated")),
                    bool(auth_operation.get("deprecated")),
                    f"Expected exactly one deprecated alias for {method.upper()} {suffix}",
                )
