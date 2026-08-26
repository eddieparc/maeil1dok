from collections import Counter

from django.test import SimpleTestCase, override_settings

from authz.registry import ENDPOINTS, ENDPOINTS_BY_ROUTE_NAME, PATH_ALIAS_GROUPS
from tests.api_characterization import enumerate_routes


API_PREFIX = "api/v1/"


def _api_routes():
    return [
        route
        for route in enumerate_routes()
        if route.pattern.startswith(API_PREFIX)
    ]


def _permission_classes(callback):
    view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
    if view_class is None:
        return ()
    return tuple(getattr(view_class, "permission_classes", ()))


def _permission_name(permission_class):
    return f"{permission_class.__module__}.{permission_class.__qualname__}"


def _allowed_methods(callback):
    actions = getattr(callback, "actions", None)
    if actions:
        return {method.upper() for method in actions} - {"HEAD", "OPTIONS"}

    view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
    if view_class is None:
        return {"GET"}
    view = view_class(**getattr(callback, "initkwargs", {}))
    return set(view._allowed_methods()) - {"HEAD", "OPTIONS"}


@override_settings(ROOT_URLCONF="config.test_urls")
class AuthzRegistryDriftTest(SimpleTestCase):
    maxDiff = None

    def test_registered_api_routes_are_in_the_registry(self):
        actual_route_names = {route.name for route in _api_routes()}
        registered_route_names = set(ENDPOINTS_BY_ROUTE_NAME)

        self.assertEqual(
            sorted(actual_route_names - registered_route_names),
            [],
            "Every registered API route must have an authorization policy entry.",
        )

    def test_registry_entries_resolve_to_registered_api_routes(self):
        actual_route_names = {route.name for route in _api_routes()}
        registered_route_names = set(ENDPOINTS_BY_ROUTE_NAME)

        self.assertEqual(
            sorted(registered_route_names - actual_route_names),
            [],
            "Authorization policy entries must not outlive their API routes.",
        )

    def test_recorded_permission_classes_match_the_views(self):
        mismatches = []

        for route in _api_routes():
            endpoint = ENDPOINTS_BY_ROUTE_NAME.get(route.name)
            if endpoint is None:
                continue

            recorded = {
                action.current_gate.permission_classes
                for action in endpoint.actions
            }
            if len(recorded) != 1:
                mismatches.append(
                    f"{endpoint.policy_key}: actions record different DRF permission classes"
                )
                continue

            actual = tuple(
                _permission_name(permission_class)
                for permission_class in _permission_classes(route.callback)
            )
            expected = recorded.pop()
            if actual != expected:
                mismatches.append(
                    f"{route.pattern} ({route.name}): expected {expected}, actual {actual}"
                )

        self.assertEqual(
            mismatches,
            [],
            "Registry permission_classes must describe the current view declarations.",
        )

    def test_actions_cover_every_routed_http_method(self):
        mismatches = []

        for route in _api_routes():
            endpoint = ENDPOINTS_BY_ROUTE_NAME.get(route.name)
            if endpoint is None:
                continue
            recorded_methods = {
                method
                for action in endpoint.actions
                for method in action.methods
            }
            actual_methods = _allowed_methods(route.callback)
            if recorded_methods != actual_methods:
                mismatches.append(
                    f"{route.pattern} ({route.name}): expected {sorted(recorded_methods)}, "
                    f"actual {sorted(actual_methods)}"
                )

        self.assertEqual(
            mismatches,
            [],
            "Every routed HTTP method must select a domain action.",
        )

    def test_declared_path_aliases_resolve_to_the_same_routes(self):
        routes = _api_routes()
        mismatches = []

        for alias_group in PATH_ALIAS_GROUPS:
            canonical_routes = {
                (route.pattern.removeprefix(alias_group.canonical_prefix), route.name)
                for route in routes
                if route.pattern.startswith(alias_group.canonical_prefix)
            }
            for alias_prefix in alias_group.alias_prefixes:
                alias_routes = {
                    (route.pattern.removeprefix(alias_prefix), route.name)
                    for route in routes
                    if route.pattern.startswith(alias_prefix)
                }
                if alias_routes != canonical_routes:
                    mismatches.append(
                        f"{alias_prefix} differs from {alias_group.canonical_prefix}"
                    )

        self.assertEqual(
            mismatches,
            [],
            "Declared path aliases must expose the same callbacks as the canonical prefix.",
        )

    def test_registry_keys_routes_and_action_selectors_are_unambiguous(self):
        policy_key_counts = Counter(endpoint.policy_key for endpoint in ENDPOINTS)
        route_name_counts = Counter(
            route_name
            for endpoint in ENDPOINTS
            for route_name in endpoint.route_names
        )
        errors = []

        errors.extend(
            f"duplicate policy key: {key}"
            for key, count in policy_key_counts.items()
            if count != 1
        )
        errors.extend(
            f"route name belongs to multiple policies: {name}"
            for name, count in route_name_counts.items()
            if count != 1
        )

        for endpoint in ENDPOINTS:
            actions_by_method = {}
            for action in endpoint.actions:
                for method in action.methods:
                    actions_by_method.setdefault(method, []).append(action)
            for method, actions in actions_by_method.items():
                if len(actions) == 1:
                    continue
                selectors = [action.selector for action in actions]
                if None in selectors or len(selectors) != len(set(selectors)):
                    errors.append(
                        f"{endpoint.policy_key} {method} actions need unique selectors"
                    )

        self.assertEqual(errors, [])
