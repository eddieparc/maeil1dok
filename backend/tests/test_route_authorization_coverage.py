from django.test import SimpleTestCase, override_settings
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny
from rest_framework.test import APIClient
from rest_framework.views import APIView


PUBLIC_ROUTE_NAMES = frozenset({
    "available-plans",
    "bible-cache-content",
    "bible-cache-search",
    "bible-cache-status",
    "bible-cache-versions",
    "chapter-detail",
    "check_nickname",
    "check_username",
    "complete_kakao_signup",
    "complete_social_signup",
    "csrf_token",
    "email_login",
    "email_register",
    "get_followers",
    "get_following",
    "get_user_achievements",
    "get_user_calendar",
    "get_user_profile",
    "group-detail",
    "group-members",
    "group-scoreboard",
    "groups-list",
    "hasena-calendar",
    "hasena-day",
    "hasena-summary",
    "login",
    "logout",
    "next-reading-position",
    "plan-stats",
    "progress-stats",
    "register",
    "request_password_reset",
    "reset_password",
    "schedules-month",
    "schedules-today",
    "scoreboard",
    "search_users",
    "send_verification_email",
    "session_bridge_consume",
    "social_login",
    "social_login_v2",
    "token_obtain_pair",
    "token_refresh",
    "token_refresh_legacy",
    "total-users",
    "user-public-groups",
    "verify_email",
    "verify_reset_token",
})

PROTECTED_ROUTE_NAMES = frozenset({
    "account_email",
    "api-root",
    "bible-bookmark-by-chapter",
    "bible-bookmark-delete-all",
    "bible-bookmark-detail",
    "bible-bookmark-list",
    "bible-highlight-by-chapter",
    "bible-highlight-delete-all",
    "bible-highlight-detail",
    "bible-highlight-list",
    "bible-home-stats",
    "biblereadingplan-detail",
    "biblereadingplan-list",
    "biblereadingplan-schedules",
    "biblereadingplan-set-default",
    "biblereadingplan-toggle-active",
    "calendar-last-incomplete",
    "calendar-month",
    "calendar-setting-detail",
    "calendar-settings",
    "calendar-settings-reorder",
    "catchup-create",
    "catchup-preview",
    "catchup-schedule-toggle",
    "catchup-session-abandon",
    "catchup-session-complete",
    "catchup-session-detail",
    "catchup-session-schedules",
    "catchup-session-update",
    "catchup-sessions-active",
    "catchup-status",
    "certification-progress",
    "create-group",
    "delete_account",
    "follow_user",
    "friends-scoreboard",
    "get_friends",
    "get_linked_accounts",
    "get_reading_settings",
    "get_user",
    "group-member-progress",
    "group-visibility",
    "hasena-record-list",
    "hasena-record-update",
    "hasena-stats",
    "hasena-summaries-list",
    "hasena-summary-cron",
    "hasena-summary-regenerate",
    "hasena-summary-update",
    "hasena-sync",
    "hasena-user-status",
    "invite-to-group",
    "issue_oauth_link_state",
    "join-group",
    "leave-group",
    "link_social_account",
    "logout_all_devices",
    "merge_accounts",
    "my-invitations",
    "my-ranking",
    "notification-inbox",
    "notification-push-config",
    "notification-push-register",
    "notification-push-remove",
    "notification-read",
    "notification-settings",
    "notification_settings",
    "notifications-mark-all-read",
    "personal-record-by-book",
    "personal-record-dates",
    "personal-record-list",
    "personal-record-stats",
    "plan-subscription-detail",
    "plan-subscription-toggle-active",
    "reading-position",
    "reflection-note-by-chapter",
    "reflection-note-delete-all",
    "reflection-note-detail",
    "reflection-note-list",
    "resend_verification_email",
    "respond-invitation",
    "schedule-detail",
    "schedule-list",
    "session_bridge_issue",
    "set_password",
    "unfollow_user",
    "unlink_social_account",
    "update_bible_progress",
    "update_reading_settings",
    "update-video-intro-progress",
    "update_user_profile",
    "upload-schedules-excel",
    "upload-video-intros",
    "user-plans",
    "user-video-intros",
    "verify_auth",
})

MIXED_AUTH_ROUTE_NAMES = frozenset({
    "plan-subscription-list",
    "video-intro-detail",
    "video-intro-list",
})

CUSTOM_GUARDED_ROUTE_NAMES = frozenset({
    "hasena-summary-cron",
    "hasena-sync",
})


def _route_keys(patterns, prefix=""):
    keys = []
    for pattern in patterns:
        route = f"{prefix}{pattern.pattern}"
        if isinstance(pattern, URLResolver):
            keys.extend(_route_keys(pattern.url_patterns, route))
        elif isinstance(pattern, URLPattern) and route.startswith("api/v1/"):
            keys.append((route, pattern.name or "<unnamed>"))
    return keys


def _route_name_keys():
    return {
        name
        for route, name in _route_keys(get_resolver().url_patterns)
        if route.startswith(
            (
                "api/v1/auth/",
                "api/v1/accounts/",
                "api/v1/todos/",
                "api/v1/bible-cache/",
            )
        )
    }


def _route_callbacks_by_name(patterns, prefix=""):
    callbacks = {}
    for pattern in patterns:
        route = f"{prefix}{pattern.pattern}"
        if isinstance(pattern, URLResolver):
            callbacks.update(_route_callbacks_by_name(pattern.url_patterns, route))
        elif isinstance(pattern, URLPattern) and route.startswith("api/v1/"):
            callbacks[pattern.name or "<unnamed>"] = pattern.callback
    return callbacks


def _route_callbacks(patterns, prefix=""):
    callbacks = []
    for pattern in patterns:
        route = f"{prefix}{pattern.pattern}"
        if isinstance(pattern, URLResolver):
            callbacks.extend(_route_callbacks(pattern.url_patterns, route))
        elif isinstance(pattern, URLPattern) and route.startswith("api/v1/"):
            callbacks.append((route, pattern.name or "<unnamed>", pattern.callback))
    return callbacks


def _permission_classes(callback):
    view_cls = getattr(callback, "cls", None)
    if view_cls is not None:
        return tuple(getattr(view_cls, "permission_classes", ()))
    return tuple(getattr(callback, "permission_classes", ()))


def _is_function_based_drf_api_view(callback):
    view_cls = getattr(callback, "cls", None)
    return (
        view_cls is not None
        and issubclass(view_cls, APIView)
        and any(
            getattr(handler, "__name__", None) == "handler"
            and getattr(handler, "__qualname__", "").endswith(
                "api_view.<locals>.decorator.<locals>.handler"
            )
            for handler in view_cls.__dict__.values()
        )
    )


@override_settings(ROOT_URLCONF="config.test_urls")
class RouteAuthorizationCoverageTest(SimpleTestCase):
    maxDiff = None

    def test_accounts_and_todos_routes_have_explicit_auth_classification(self):
        route_names = _route_name_keys()
        classified = PUBLIC_ROUTE_NAMES | PROTECTED_ROUTE_NAMES | MIXED_AUTH_ROUTE_NAMES

        self.assertEqual(
            sorted(route_names - classified),
            [],
            "Every auth/accounts/todos/bible-cache API route must be classified as public, protected, or mixed.",
        )

    def test_route_auth_classification_is_unambiguous(self):
        self.assertEqual(
            sorted(
                (PUBLIC_ROUTE_NAMES & PROTECTED_ROUTE_NAMES)
                | (PUBLIC_ROUTE_NAMES & MIXED_AUTH_ROUTE_NAMES)
                | (PROTECTED_ROUTE_NAMES & MIXED_AUTH_ROUTE_NAMES)
            ),
            [],
            "A route name must have exactly one auth classification.",
        )

    def test_protected_routes_do_not_use_allow_any_without_custom_guard(self):
        callbacks = _route_callbacks_by_name(get_resolver().url_patterns)
        unguarded = []

        for name in sorted(PROTECTED_ROUTE_NAMES - CUSTOM_GUARDED_ROUTE_NAMES):
            permission_classes = _permission_classes(callbacks[name])
            if AllowAny in permission_classes:
                unguarded.append(name)

        self.assertEqual(
            unguarded,
            [],
            "Protected routes must not use AllowAny unless listed as custom guarded.",
        )

    def test_function_based_drf_routes_declare_permission_classes(self):
        missing_explicit_permissions = []

        for route, name, callback in _route_callbacks(get_resolver().url_patterns):
            if not route.startswith(
                (
                    "api/v1/auth/",
                    "api/v1/accounts/",
                    "api/v1/todos/",
                    "api/v1/bible-cache/",
                )
            ):
                continue

            if (
                _is_function_based_drf_api_view(callback)
                and callback.cls.permission_classes is APIView.permission_classes
            ):
                missing_explicit_permissions.append(f"{route} ({name})")

        self.assertEqual(
            missing_explicit_permissions,
            [],
            "Function-based DRF API routes must explicitly declare permission classes.",
        )

    def test_user_video_intros_route_declares_its_own_permission_classes(self):
        callback = _route_callbacks_by_name(get_resolver().url_patterns)[
            "user-video-intros"
        ]

        self.assertIsNot(
            callback.cls.permission_classes,
            APIView.permission_classes,
            "The user-video-intros route must declare authentication instead of inheriting APIView defaults.",
        )


@override_settings(ROOT_URLCONF="config.test_urls")
class RepresentativeProtectedRouteTest(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_requests_are_denied_on_representative_protected_routes(self):
        protected_urls = [
            "/api/v1/auth/account-email/",
            "/api/v1/todos/calendar/settings/",
            "/api/v1/todos/bible/bookmarks/",
        ]

        for url in protected_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertIn(response.status_code, (401, 403))
