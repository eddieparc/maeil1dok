import ast
from pathlib import Path

from django.test import SimpleTestCase


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCAN_DIRS = (BACKEND_DIR / "accounts", BACKEND_DIR / "todos")
REQUIRED_REST_FRAMEWORK_KEYS = frozenset({
    "DEFAULT_AUTHENTICATION_CLASSES",
    "DEFAULT_PERMISSION_CLASSES",
})


def _test_sources():
    for scan_dir in SCAN_DIRS:
        yield from sorted(scan_dir.glob("test*.py"))


def _parse_source(path):
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _is_settings_rest_framework_spread(node):
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "REST_FRAMEWORK"
        and isinstance(node.value, ast.Name)
        and node.value.id == "settings"
    )


def _dict_literal_keys(node):
    return {
        key.value
        for key in node.keys
        if isinstance(key, ast.Constant) and isinstance(key.value, str)
    }


def _keeps_rest_framework_auth_defaults(node):
    has_settings_spread = any(
        key is None and _is_settings_rest_framework_spread(value)
        for key, value in zip(node.keys, node.values)
    )
    return has_settings_spread or REQUIRED_REST_FRAMEWORK_KEYS.issubset(_dict_literal_keys(node))


def _rest_framework_dict_assignments(tree):
    assignments = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            for target in node.targets:
                if isinstance(target, ast.Name) and "REST_FRAMEWORK" in target.id:
                    assignments[target.id] = node.value
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and "REST_FRAMEWORK" in node.target.id
            and isinstance(node.value, ast.Dict)
        ):
            assignments[node.target.id] = node.value
    return assignments


def _override_settings_rest_framework_payloads(tree):
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function_name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
        if function_name != "override_settings":
            continue
        for keyword in node.keywords:
            if keyword.arg == "REST_FRAMEWORK":
                yield keyword.value


class ParallelSafeRestFrameworkOverrideTests(SimpleTestCase):
    maxDiff = None

    def test_rest_framework_override_dicts_retain_auth_and_permission_defaults(self):
        unsafe = []

        for path in _test_sources():
            tree = _parse_source(path)
            relative_path = path.relative_to(BACKEND_DIR)
            for name, value in _rest_framework_dict_assignments(tree).items():
                if not _keeps_rest_framework_auth_defaults(value):
                    unsafe.append(f"{relative_path}:{value.lineno} {name}")

        self.assertEqual(
            unsafe,
            [],
            "REST_FRAMEWORK test override dicts must spread settings.REST_FRAMEWORK "
            "or explicitly retain auth and permission defaults.",
        )

    def test_override_settings_rest_framework_payloads_are_static_and_safe(self):
        unsafe = []

        for path in _test_sources():
            tree = _parse_source(path)
            assignments = _rest_framework_dict_assignments(tree)
            relative_path = path.relative_to(BACKEND_DIR)
            for payload in _override_settings_rest_framework_payloads(tree):
                if isinstance(payload, ast.Dict):
                    value = payload
                    label = "inline REST_FRAMEWORK dict"
                elif isinstance(payload, ast.Name) and payload.id in assignments:
                    value = assignments[payload.id]
                    label = payload.id
                else:
                    unsafe.append(f"{relative_path}:{payload.lineno} unsupported REST_FRAMEWORK payload")
                    continue

                if not _keeps_rest_framework_auth_defaults(value):
                    unsafe.append(f"{relative_path}:{value.lineno} {label}")

        self.assertEqual(
            unsafe,
            [],
            "override_settings(REST_FRAMEWORK=...) must use a static payload that "
            "preserves DEFAULT_AUTHENTICATION_CLASSES and DEFAULT_PERMISSION_CLASSES.",
        )
