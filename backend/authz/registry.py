"""Machine-consumed endpoint-to-action authorization inventory.

This module records current behavior. It does not evaluate authorization policy.
DRF permissions remain the coarse gate, while ``requirements`` describe the
inline object, relationship, credential, and visibility checks that exist today.
"""

from __future__ import annotations

from dataclasses import dataclass


ALLOW_ANY = "rest_framework.permissions.AllowAny"
IS_AUTHENTICATED = "rest_framework.permissions.IsAuthenticated"
IS_ADMIN_USER = "rest_framework.permissions.IsAdminUser"


@dataclass(frozen=True)
class CurrentGate:
    permission_classes: tuple[str, ...]
    requirements: tuple[str, ...]
    permission_source: str = "explicit"


@dataclass(frozen=True)
class Action:
    name: str
    resource_type: str
    methods: tuple[str, ...]
    current_gate: CurrentGate
    selector: str | None = None


@dataclass(frozen=True)
class Endpoint:
    policy_key: str
    route_names: tuple[str, ...]
    actions: tuple[Action, ...]


@dataclass(frozen=True)
class PathAliasGroup:
    canonical_prefix: str
    alias_prefixes: tuple[str, ...]


PATH_ALIAS_GROUPS = (
    PathAliasGroup(
        canonical_prefix="api/v1/auth/",
        alias_prefixes=("api/v1/accounts/",),
    ),
)


def _gate(
    permission_classes: tuple[str, ...],
    *requirements: str,
    permission_source: str = "explicit",
) -> CurrentGate:
    return CurrentGate(permission_classes, requirements, permission_source)


def _action(
    name: str,
    resource_type: str,
    methods: str | tuple[str, ...],
    current_gate: CurrentGate,
    *,
    selector: str | None = None,
) -> Action:
    if isinstance(methods, str):
        methods = (methods,)
    return Action(name, resource_type, methods, current_gate, selector)


def _endpoint(
    policy_key: str,
    route_names: str | tuple[str, ...],
    *actions: Action,
) -> Endpoint:
    if isinstance(route_names, str):
        route_names = (route_names,)
    return Endpoint(policy_key, route_names, actions)


PUBLIC = _gate((ALLOW_ANY,), "anonymous_allowed")
AUTHENTICATED = _gate((IS_AUTHENTICATED,), "authenticated")
AUTHENTICATED_SELF = _gate(
    (IS_AUTHENTICATED,),
    "authenticated",
    "resource_owner_is_subject",
)
STAFF = _gate(
    (IS_AUTHENTICATED, IS_ADMIN_USER),
    "authenticated",
    "subject_is_staff",
)
INLINE_STAFF_PUBLIC = _gate(
    (ALLOW_ANY,),
    "authenticated",
    "subject_is_staff",
)
INLINE_STAFF_AUTHENTICATED = _gate(
    (IS_AUTHENTICATED,),
    "authenticated",
    "subject_is_staff",
)
PUBLIC_ACTIVE = _gate((ALLOW_ANY,), "anonymous_allowed", "resource_is_active")
PUBLIC_OR_SELF = _gate(
    (ALLOW_ANY,),
    "resource_is_public_or_owner_is_subject",
)
AUTHENTICATED_OWNER = _gate(
    (IS_AUTHENTICATED,),
    "authenticated",
    "resource_owner_is_subject",
)


ENDPOINTS = (
    # Accounts. Both /api/v1/auth/ and /api/v1/accounts/ resolve to these names.
    _endpoint(
        "auth_session.authenticate",
        ("token_obtain_pair", "login"),
        _action(
            "authenticate",
            "auth_session",
            "POST",
            _gate((), "valid_username_and_password", permission_source="view_class"),
        ),
    ),
    _endpoint(
        "auth_session.refresh",
        ("token_refresh", "token_refresh_legacy"),
        _action(
            "refresh_session",
            "auth_session",
            "POST",
            _gate(
                (),
                "valid_refresh_token",
                "token_user_is_active",
                "token_version_matches",
                "csrf_if_cookie_token",
                permission_source="view_class",
            ),
        ),
    ),
    _endpoint(
        "auth_session.logout",
        "logout",
        _action(
            "logout",
            "auth_session",
            "POST",
            _gate((ALLOW_ANY,), "anonymous_allowed", "csrf_if_refresh_cookie_present"),
        ),
    ),
    _endpoint(
        "auth_session.csrf",
        "csrf_token",
        _action("issue_csrf_token", "csrf_token", "GET", PUBLIC),
    ),
    _endpoint(
        "auth_session.verify",
        "verify_auth",
        _action("verify_session", "auth_session", "GET", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_account.register_legacy",
        "register",
        _action("register_account", "user_account", "POST", PUBLIC),
    ),
    _endpoint(
        "user_account.current",
        "get_user",
        _action("view_current_account", "user_account", "GET", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "auth_session.social_login_legacy",
        "social_login",
        _action(
            "authenticate_social",
            "auth_session",
            "POST",
            _gate((ALLOW_ANY,), "valid_provider_proof"),
        ),
    ),
    _endpoint(
        "user_account.username_availability",
        "check_username",
        _action("check_username_availability", "user_account", "POST", PUBLIC),
    ),
    _endpoint(
        "user_profile.nickname_availability",
        "check_nickname",
        _action("check_nickname_availability", "user_profile", "POST", PUBLIC),
    ),
    _endpoint(
        "user_account.complete_kakao_signup",
        "complete_kakao_signup",
        _action(
            "complete_social_signup",
            "user_account",
            "POST",
            _gate((ALLOW_ANY,), "valid_kakao_proof", "provider_id_matches"),
        ),
    ),
    _endpoint(
        "user_profile.detail",
        "get_user_profile",
        _action("view_profile", "user_profile", "GET", PUBLIC_OR_SELF),
    ),
    _endpoint(
        "user_profile.update",
        "update_user_profile",
        _action("update_profile", "user_profile", "PUT", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_profile.calendar",
        "get_user_calendar",
        _action("view_profile_calendar", "user_profile", "GET", PUBLIC_OR_SELF),
    ),
    _endpoint(
        "user_profile.achievements",
        "get_user_achievements",
        _action("view_achievements", "user_profile", "GET", PUBLIC_OR_SELF),
    ),
    _endpoint(
        "user_profile.follow",
        "follow_user",
        _action(
            "follow",
            "user_profile",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "target_user_is_live",
                "target_profile_is_public",
                "target_is_not_subject",
            ),
        ),
    ),
    _endpoint(
        "user_profile.unfollow",
        "unfollow_user",
        _action("unfollow", "user_profile", "DELETE", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_profile.followers",
        "get_followers",
        _action(
            "view_followers",
            "user_profile",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "target_profile_is_public_or_owner_is_subject",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "user_profile.following",
        "get_following",
        _action(
            "view_following",
            "user_profile",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "target_profile_is_public_or_owner_is_subject",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "user_profile.friends",
        "get_friends",
        _action(
            "view_friends",
            "user_profile",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "relationship_belongs_to_subject",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "user_profile.search",
        "search_users",
        _action(
            "search_profiles",
            "user_profile",
            "GET",
            _gate((ALLOW_ANY,), "returned_profiles_are_public_or_subject"),
        ),
    ),
    _endpoint(
        "reading_settings.view",
        "get_reading_settings",
        _action("view_reading_settings", "reading_settings", "GET", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "reading_settings.update",
        "update_reading_settings",
        _action("update_reading_settings", "reading_settings", "PATCH", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_account.register_email",
        "email_register",
        _action("register_email_account", "user_account", "POST", PUBLIC),
    ),
    _endpoint(
        "auth_session.email_login",
        "email_login",
        _action(
            "authenticate_email",
            "auth_session",
            "POST",
            _gate((ALLOW_ANY,), "valid_email_or_username_and_password", "account_is_eligible"),
        ),
    ),
    _endpoint(
        "auth_session.social_login",
        "social_login_v2",
        _action(
            "authenticate_social",
            "auth_session",
            "POST",
            _gate((ALLOW_ANY,), "valid_provider_proof"),
        ),
    ),
    _endpoint(
        "user_account.complete_social_signup",
        "complete_social_signup",
        _action(
            "complete_social_signup",
            "user_account",
            "POST",
            _gate((ALLOW_ANY,), "valid_signup_or_provider_proof", "provider_id_matches"),
        ),
    ),
    _endpoint(
        "social_account.list",
        "get_linked_accounts",
        _action("view_linked_accounts", "social_account", "GET", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_account.email",
        "account_email",
        _action("view_account_email", "user_account", "GET", AUTHENTICATED_SELF),
        _action(
            "change_account_email",
            "user_account",
            "PATCH",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "current_password_matches",
            ),
        ),
    ),
    _endpoint(
        "notification_settings.account",
        "notification_settings",
        _action("view_notification_settings", "notification_settings", "GET", AUTHENTICATED_SELF),
        _action("update_notification_settings", "notification_settings", "PATCH", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "social_account.link_state",
        "issue_oauth_link_state",
        _action("issue_link_state", "social_account", "POST", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "social_account.link",
        "link_social_account",
        _action(
            "link_social_account",
            "social_account",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "state_belongs_to_subject",
                "valid_provider_proof",
            ),
        ),
    ),
    _endpoint(
        "social_account.unlink",
        "unlink_social_account",
        _action(
            "unlink_social_account",
            "social_account",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "another_login_method_remains",
            ),
        ),
    ),
    _endpoint(
        "user_account.set_password",
        "set_password",
        _action(
            "set_password",
            "user_account",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "current_password_if_present",
            ),
        ),
    ),
    _endpoint(
        "auth_session.logout_all",
        "logout_all_devices",
        _action("logout_all_sessions", "auth_session", "POST", AUTHENTICATED_SELF),
    ),
    _endpoint(
        "user_account.merge",
        "merge_accounts",
        _action(
            "merge_accounts",
            "user_account",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "target_account_proof",
                "current_password_when_target_account_is_kept",
            ),
        ),
    ),
    _endpoint(
        "user_account.delete",
        "delete_account",
        _action(
            "delete_account",
            "user_account",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "current_password_matches",
                "delete_confirmation_is_true",
            ),
        ),
    ),
    _endpoint(
        "email_verification.send",
        "send_verification_email",
        _action("send_verification", "email_verification", "POST", PUBLIC),
    ),
    _endpoint(
        "email_verification.verify",
        "verify_email",
        _action(
            "verify_email",
            "email_verification",
            "POST",
            _gate((ALLOW_ANY,), "valid_unused_unexpired_verification_token"),
        ),
    ),
    _endpoint(
        "email_verification.resend",
        "resend_verification_email",
        _action(
            "resend_verification",
            "email_verification",
            "POST",
            _gate((IS_AUTHENTICATED,), "authenticated", "email_belongs_to_subject", "email_is_unverified"),
        ),
    ),
    _endpoint(
        "password_reset.request",
        "request_password_reset",
        _action("request_password_reset", "password_reset", "POST", PUBLIC),
    ),
    _endpoint(
        "password_reset.verify",
        "verify_reset_token",
        _action(
            "verify_reset_token",
            "password_reset",
            "POST",
            _gate((ALLOW_ANY,), "valid_unused_unexpired_reset_token"),
        ),
    ),
    _endpoint(
        "password_reset.complete",
        "reset_password",
        _action(
            "reset_password",
            "password_reset",
            "POST",
            _gate((ALLOW_ANY,), "valid_unused_unexpired_reset_token"),
        ),
    ),
    _endpoint(
        "session_bridge.issue",
        "session_bridge_issue",
        _action(
            "issue_session_bridge",
            "session_bridge",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_account_is_eligible",
            ),
        ),
    ),
    _endpoint(
        "session_bridge.consume",
        "session_bridge_consume",
        _action(
            "consume_session_bridge",
            "session_bridge",
            "GET",
            _gate((ALLOW_ANY,), "valid_unused_bridge_code", "code_user_is_eligible"),
        ),
    ),

    # Todos router and staff plan administration.
    _endpoint(
        "api_directory.browse",
        "api-root",
        _action(
            "browse_api",
            "api_directory",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                permission_source="drf_default",
            ),
        ),
    ),
    _endpoint(
        "bible_plan.collection",
        "biblereadingplan-list",
        _action("list_plans", "bible_plan", "GET", STAFF),
        _action("create_plan", "bible_plan", "POST", STAFF),
    ),
    _endpoint(
        "bible_plan.detail",
        "biblereadingplan-detail",
        _action("view_plan", "bible_plan", "GET", STAFF),
        _action("update_plan", "bible_plan", ("PUT", "PATCH"), STAFF),
        _action("delete_plan", "bible_plan", "DELETE", STAFF),
    ),
    _endpoint(
        "bible_plan.schedules",
        "biblereadingplan-schedules",
        _action("view_plan_schedules", "bible_schedule", "GET", STAFF),
    ),
    _endpoint(
        "bible_plan.set_default",
        "biblereadingplan-set-default",
        _action("set_default", "bible_plan", "POST", STAFF),
    ),
    _endpoint(
        "bible_plan.toggle_active",
        "biblereadingplan-toggle-active",
        _action("toggle_active", "bible_plan", "POST", STAFF),
    ),

    # Personal Bible artifacts. Every queryset and create is scoped to request.user.
    _endpoint(
        "bible_bookmark.collection",
        "bible-bookmark-list",
        _action("list_bookmarks", "bible_bookmark", "GET", AUTHENTICATED_OWNER),
        _action("create_bookmark", "bible_bookmark", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_bookmark.detail",
        "bible-bookmark-detail",
        _action("view_bookmark", "bible_bookmark", "GET", AUTHENTICATED_OWNER),
        _action("update_bookmark", "bible_bookmark", ("PUT", "PATCH"), AUTHENTICATED_OWNER),
        _action("delete_bookmark", "bible_bookmark", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_bookmark.by_chapter",
        "bible-bookmark-by-chapter",
        _action("view_bookmarks_by_chapter", "bible_bookmark", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_bookmark.clear",
        "bible-bookmark-delete-all",
        _action("clear_bookmarks", "bible_bookmark", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reflection_note.collection",
        "reflection-note-list",
        _action("list_notes", "reflection_note", "GET", AUTHENTICATED_OWNER),
        _action("create_note", "reflection_note", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reflection_note.detail",
        "reflection-note-detail",
        _action("view_note", "reflection_note", "GET", AUTHENTICATED_OWNER),
        _action("update_note", "reflection_note", ("PUT", "PATCH"), AUTHENTICATED_OWNER),
        _action("delete_note", "reflection_note", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reflection_note.by_chapter",
        "reflection-note-by-chapter",
        _action("view_notes_by_chapter", "reflection_note", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reflection_note.clear",
        "reflection-note-delete-all",
        _action("clear_notes", "reflection_note", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_highlight.collection",
        "bible-highlight-list",
        _action("list_highlights", "bible_highlight", "GET", AUTHENTICATED_OWNER),
        _action("create_highlight", "bible_highlight", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_highlight.detail",
        "bible-highlight-detail",
        _action("view_highlight", "bible_highlight", "GET", AUTHENTICATED_OWNER),
        _action("update_highlight", "bible_highlight", ("PUT", "PATCH"), AUTHENTICATED_OWNER),
        _action("delete_highlight", "bible_highlight", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_highlight.by_chapter",
        "bible-highlight-by-chapter",
        _action("view_highlights_by_chapter", "bible_highlight", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_highlight.clear",
        "bible-highlight-delete-all",
        _action("clear_highlights", "bible_highlight", "DELETE", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "personal_reading_record.collection",
        "personal-record-list",
        _action("list_reading_records", "personal_reading_record", "GET", AUTHENTICATED_OWNER),
        _action("record_reading", "personal_reading_record", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "personal_reading_record.by_book",
        "personal-record-by-book",
        _action("view_reading_records_by_book", "personal_reading_record", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "personal_reading_record.dates",
        "personal-record-dates",
        _action("view_reading_dates", "personal_reading_record", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "personal_reading_record.stats",
        "personal-record-stats",
        _action("view_reading_record_stats", "personal_reading_record", "GET", AUTHENTICATED_OWNER),
    ),

    # Schedules, subscriptions, progress, and plan-facing reads.
    _endpoint(
        "bible_schedule.collection",
        "schedule-list",
        _action(
            "list_schedules",
            "bible_schedule",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_is_staff_or_has_active_plan_subscription",
            ),
        ),
        _action("create_schedule", "bible_schedule", "POST", INLINE_STAFF_AUTHENTICATED),
    ),
    _endpoint(
        "bible_schedule.detail",
        "schedule-detail",
        _action(
            "view_schedule",
            "bible_schedule",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_is_staff_or_has_active_plan_subscription",
            ),
        ),
        _action("update_schedule", "bible_schedule", "PUT", INLINE_STAFF_AUTHENTICATED),
        _action("delete_schedule", "bible_schedule", "DELETE", INLINE_STAFF_AUTHENTICATED),
    ),
    _endpoint(
        "bible_schedule.month",
        "schedules-month",
        _action(
            "view_month_schedules",
            "bible_schedule",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "plan_is_active",
                "authenticated_active_subscriber_sees_own_completion",
            ),
        ),
    ),
    _endpoint(
        "bible_schedule.today",
        "schedules-today",
        _action(
            "view_today_schedules",
            "bible_schedule",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "plan_is_active",
                "authenticated_active_subscriber_sees_own_completion",
            ),
        ),
    ),
    _endpoint(
        "bible_schedule.upload",
        "upload-schedules-excel",
        _action("upload_schedules", "bible_schedule", "POST", STAFF),
    ),
    _endpoint(
        "reading_progress.update",
        "update_bible_progress",
        _action(
            "update_progress",
            "reading_progress",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "active_subscription_owner_is_subject",
                "schedule_belongs_to_subscription_plan",
            ),
        ),
    ),
    _endpoint(
        "reading_progress.certification",
        "certification-progress",
        _action(
            "view_certification_progress",
            "reading_progress",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "active_subscription_owner_is_subject",
            ),
        ),
    ),
    _endpoint(
        "notification.inbox",
        "notification-inbox",
        _action("view_notifications", "notification", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "notification.settings",
        "notification-settings",
        _action("view_notification_settings", "notification_settings", "GET", AUTHENTICATED_OWNER),
        _action("update_notification_settings", "notification_settings", "PATCH", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "notification.push_config",
        "notification-push-config",
        _action("view_push_config", "push_configuration", "GET", AUTHENTICATED),
    ),
    _endpoint(
        "notification.push_subscription.register",
        "notification-push-register",
        _action("register_push_subscription", "push_subscription", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "notification.push_subscription.remove",
        "notification-push-remove",
        _action("remove_push_subscription", "push_subscription", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "notification.mark_read",
        "notification-read",
        _action("mark_notification_read", "notification", "PATCH", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "notification.mark_all_read",
        "notifications-mark-all-read",
        _action("mark_all_notifications_read", "notification", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_plan.available",
        "available-plans",
        _action("view_available_plans", "bible_plan", "GET", PUBLIC_ACTIVE),
    ),
    _endpoint(
        "bible_plan.user_options",
        "user-plans",
        _action(
            "view_subscription_options",
            "bible_plan",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subscriptions_belong_to_subject",
                "unsubscribed_plans_are_active",
            ),
        ),
    ),
    _endpoint(
        "plan_subscription.collection",
        "plan-subscription-list",
        _action(
            "view_subscriptions",
            "plan_subscription",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "anonymous_sees_active_plans",
                "authenticated_subject_sees_own_subscriptions",
            ),
        ),
        _action(
            "subscribe",
            "plan_subscription",
            "POST",
            _gate((ALLOW_ANY,), "authenticated", "subscription_owner_is_subject"),
        ),
    ),
    _endpoint(
        "plan_subscription.detail",
        "plan-subscription-detail",
        _action("view_subscription", "plan_subscription", "GET", AUTHENTICATED_OWNER),
        _action("update_subscription", "plan_subscription", "PUT", AUTHENTICATED_OWNER),
        _action(
            "unsubscribe",
            "plan_subscription",
            "DELETE",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "subscription_is_not_default",
            ),
        ),
    ),
    _endpoint(
        "plan_subscription.toggle_active",
        "plan-subscription-toggle-active",
        _action(
            "toggle_active",
            "plan_subscription",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "resource_owner_is_subject",
                "default_subscription_cannot_be_deactivated",
                "inactive_plan_subscription_cannot_be_reactivated",
            ),
        ),
    ),
    _endpoint(
        "bible_plan.chapter_detail",
        "chapter-detail",
        _action(
            "view_chapter_detail",
            "bible_plan",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "plan_is_active",
                "authenticated_active_subscriber_sees_own_completion",
            ),
        ),
    ),
    _endpoint(
        "bible_plan.next_position",
        "next-reading-position",
        _action(
            "view_next_reading_position",
            "bible_plan",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "plan_is_active",
                "authenticated_active_subscriber_sees_own_progress",
            ),
        ),
    ),

    # Video introductions.
    _endpoint(
        "video_intro.collection",
        "video-intro-list",
        _action("view_video_intros", "video_intro", "GET", PUBLIC_ACTIVE),
        _action("create_video_intro", "video_intro", "POST", INLINE_STAFF_PUBLIC),
    ),
    _endpoint(
        "video_intro.detail",
        "video-intro-detail",
        _action("view_video_intro", "video_intro", "GET", PUBLIC_ACTIVE),
        _action("delete_video_intro", "video_intro", "DELETE", INLINE_STAFF_PUBLIC),
    ),
    _endpoint(
        "video_intro.upload",
        "upload-video-intros",
        _action("upload_video_intros", "video_intro", "POST", STAFF),
    ),
    _endpoint(
        "video_intro.progress",
        "update-video-intro-progress",
        _action(
            "update_video_progress",
            "video_intro_progress",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "active_subscription_owner_is_subject",
                "progress_owner_is_subject",
            ),
        ),
    ),
    _endpoint(
        "video_intro.user",
        "user-video-intros",
        _action(
            "view_subscribed_video_intros",
            "video_intro",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "active_subscription_owner_is_subject",
            ),
        ),
    ),

    # Hasena records, entries, and summaries.
    _endpoint(
        "hasena_record.collection",
        "hasena-record-list",
        _action("list_hasena_records", "hasena_record", "GET", AUTHENTICATED_OWNER),
        _action("create_hasena_record", "hasena_record", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "hasena_record.update",
        "hasena-record-update",
        _action("update_hasena_record", "hasena_record", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "hasena_record.status",
        "hasena-user-status",
        _action("view_hasena_status", "hasena_record", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "hasena_entry.day",
        "hasena-day",
        _action(
            "view_hasena_day",
            "hasena_entry",
            "GET",
            _gate((ALLOW_ANY,), "anonymous_allowed", "authenticated_subject_sees_own_completion"),
        ),
    ),
    _endpoint(
        "hasena_entry.calendar",
        "hasena-calendar",
        _action(
            "view_hasena_calendar",
            "hasena_entry",
            "GET",
            _gate((ALLOW_ANY,), "anonymous_allowed", "authenticated_subject_sees_own_completion"),
        ),
    ),
    _endpoint(
        "hasena_entry.sync",
        "hasena-sync",
        _action(
            "sync_hasena_entries",
            "hasena_entry",
            "POST",
            _gate((ALLOW_ANY,), "valid_cron_secret"),
        ),
    ),
    _endpoint(
        "hasena_summary.detail",
        "hasena-summary",
        _action(
            "view_summary",
            "hasena_summary",
            "GET",
            PUBLIC,
            selector="query.generate != true",
        ),
        _action(
            "generate_summary",
            "hasena_summary",
            "GET",
            INLINE_STAFF_PUBLIC,
            selector="query.generate == true",
        ),
    ),
    _endpoint(
        "hasena_summary.cron",
        "hasena-summary-cron",
        _action(
            "generate_summary",
            "hasena_summary",
            "POST",
            _gate((ALLOW_ANY,), "valid_cron_secret"),
        ),
    ),
    _endpoint(
        "hasena_record.stats",
        "hasena-stats",
        _action("view_hasena_stats", "hasena_record", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "hasena_summary.collection",
        "hasena-summaries-list",
        _action("list_summaries", "hasena_summary", "GET", INLINE_STAFF_AUTHENTICATED),
    ),
    _endpoint(
        "hasena_summary.regenerate",
        "hasena-summary-regenerate",
        _action("regenerate_summary", "hasena_summary", "POST", INLINE_STAFF_AUTHENTICATED),
    ),
    _endpoint(
        "hasena_summary.update",
        "hasena-summary-update",
        _action("update_summary", "hasena_summary", "PUT", INLINE_STAFF_AUTHENTICATED),
    ),

    # Public aggregates and scoreboards.
    _endpoint(
        "user_account.stats",
        "total-users",
        _action("view_user_stats", "user_account", "GET", PUBLIC_ACTIVE),
    ),
    _endpoint(
        "bible_plan.stats",
        "plan-stats",
        _action("view_plan_stats", "bible_plan", "GET", PUBLIC_ACTIVE),
    ),
    _endpoint(
        "reading_progress.stats",
        "progress-stats",
        _action(
            "view_progress_stats",
            "reading_progress",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "plan_is_active",
                "authenticated_active_subscriber_sees_own_progress",
            ),
        ),
    ),
    _endpoint(
        "scoreboard.global",
        "scoreboard",
        _action(
            "view_scoreboard",
            "scoreboard",
            "GET",
            _gate((ALLOW_ANY,), "returned_profiles_are_live_and_public_or_subject"),
        ),
    ),
    _endpoint(
        "scoreboard.friends",
        "friends-scoreboard",
        _action(
            "view_friends_scoreboard",
            "scoreboard",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subjects_following_or_mutual_relationships_only",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "scoreboard.group",
        "group-scoreboard",
        _action(
            "view_group_scoreboard",
            "scoreboard",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "group_is_public_or_subject_is_active_member",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "scoreboard.my_ranking",
        "my-ranking",
        _action("view_my_ranking", "scoreboard", "GET", AUTHENTICATED_SELF),
    ),

    # Reading groups and invitations.
    _endpoint(
        "reading_group.collection",
        "groups-list",
        _action(
            "list_groups",
            "reading_group",
            "GET",
            _gate((ALLOW_ANY,), "group_is_public_or_subject_is_active_member"),
        ),
    ),
    _endpoint(
        "reading_group.create",
        "create-group",
        _action("create_group", "reading_group", "POST", AUTHENTICATED),
    ),
    _endpoint(
        "reading_group.detail",
        "group-detail",
        _action(
            "view_group",
            "reading_group",
            "GET",
            _gate((ALLOW_ANY,), "group_is_public_or_subject_is_active_member"),
        ),
    ),
    _endpoint(
        "reading_group.join",
        "join-group",
        _action(
            "join",
            "reading_group",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "group_has_capacity",
                "public_group_or_pending_invitation_for_subject",
            ),
        ),
    ),
    _endpoint(
        "reading_group.leave",
        "leave-group",
        _action(
            "leave",
            "reading_group",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_is_active_member",
                "group_creator_is_not_subject",
            ),
        ),
    ),
    _endpoint(
        "reading_group.members",
        "group-members",
        _action(
            "view_group_members",
            "reading_group_membership",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "group_is_public_or_subject_is_active_member",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "reading_group.member_progress",
        "group-member-progress",
        _action(
            "view_member_progress",
            "reading_group_membership",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_is_active_member",
                "returned_profiles_are_public_or_subject",
            ),
        ),
    ),
    _endpoint(
        "reading_group.invite",
        "invite-to-group",
        _action(
            "invite",
            "reading_group",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "subject_is_active_group_admin",
            ),
        ),
    ),
    _endpoint(
        "reading_group_membership.profile_visibility",
        "group-visibility",
        _action(
            "update_profile_visibility",
            "reading_group_membership",
            "PATCH",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "membership_owner_is_subject",
                "membership_is_active",
            ),
        ),
    ),
    _endpoint(
        "user_profile.groups",
        "user-public-groups",
        _action(
            "view_profile_groups",
            "reading_group",
            "GET",
            _gate(
                (ALLOW_ANY,),
                "target_profile_is_public_or_owner_is_subject",
                "other_users_groups_are_public_and_visible_in_profile",
            ),
        ),
    ),
    _endpoint(
        "group_invitation.collection",
        "my-invitations",
        _action(
            "view_invitations",
            "group_invitation",
            "GET",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "invitation_invitee_is_subject",
                "invitation_is_pending",
            ),
        ),
    ),
    _endpoint(
        "group_invitation.respond",
        "respond-invitation",
        _action(
            "respond_invitation",
            "group_invitation",
            "POST",
            _gate(
                (IS_AUTHENTICATED,),
                "authenticated",
                "invitation_invitee_is_subject",
                "invitation_is_pending",
            ),
        ),
    ),

    # Calendar settings and data.
    _endpoint(
        "calendar_settings.collection",
        "calendar-settings",
        _action("view_calendar_settings", "calendar_settings", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "calendar_settings.detail",
        "calendar-setting-detail",
        _action("update_calendar_setting", "calendar_settings", "PATCH", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "calendar_settings.reorder",
        "calendar-settings-reorder",
        _action("reorder_calendar_settings", "calendar_settings", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reading_calendar.month",
        "calendar-month",
        _action("view_calendar_month", "reading_calendar", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reading_calendar.last_incomplete",
        "calendar-last-incomplete",
        _action("view_last_incomplete", "reading_calendar", "GET", AUTHENTICATED_OWNER),
    ),

    # Catchup sessions. Every relation is scoped through a subject-owned subscription.
    _endpoint(
        "catchup.status",
        "catchup-status",
        _action("view_catchup_status", "catchup_session", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.preview",
        "catchup-preview",
        _action("preview_catchup", "catchup_session", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.create",
        "catchup-create",
        _action("create_catchup", "catchup_session", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.active",
        "catchup-sessions-active",
        _action("view_active_catchups", "catchup_session", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.detail",
        "catchup-session-detail",
        _action("view_catchup", "catchup_session", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.update",
        "catchup-session-update",
        _action("update_catchup", "catchup_session", "PATCH", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.schedules",
        "catchup-session-schedules",
        _action("view_catchup_schedules", "catchup_schedule", "GET", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.complete",
        "catchup-session-complete",
        _action("complete_catchup", "catchup_session", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup.abandon",
        "catchup-session-abandon",
        _action("abandon_catchup", "catchup_session", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "catchup_schedule.toggle",
        "catchup-schedule-toggle",
        _action("toggle_catchup_schedule", "catchup_schedule", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "reading_position.current",
        "reading-position",
        _action("view_reading_position", "reading_position", "GET", AUTHENTICATED_OWNER),
        _action("save_reading_position", "reading_position", "POST", AUTHENTICATED_OWNER),
    ),
    _endpoint(
        "bible_home.stats",
        "bible-home-stats",
        _action("view_bible_home_stats", "bible_home", "GET", AUTHENTICATED_OWNER),
    ),

    # Bible content cache.
    _endpoint(
        "bible_content.versions",
        "bible-cache-versions",
        _action("view_supported_versions", "bible_content", "GET", PUBLIC),
    ),
    _endpoint(
        "bible_content.search",
        "bible-cache-search",
        _action("search_bible_content", "bible_content", "GET", PUBLIC),
    ),
    _endpoint(
        "bible_content.chapter",
        "bible-cache-content",
        _action(
            "view_bible_content",
            "bible_content",
            "GET",
            PUBLIC,
            selector="query.force_refresh != true",
        ),
        _action(
            "force_refresh",
            "bible_content",
            "GET",
            INLINE_STAFF_PUBLIC,
            selector="query.force_refresh == true",
        ),
    ),
    _endpoint(
        "bible_content.cache_status",
        "bible-cache-status",
        _action("view_cache_status", "bible_content", "GET", PUBLIC),
    ),
)


ENDPOINTS_BY_POLICY_KEY = {endpoint.policy_key: endpoint for endpoint in ENDPOINTS}
ENDPOINTS_BY_ROUTE_NAME = {
    route_name: endpoint
    for endpoint in ENDPOINTS
    for route_name in endpoint.route_names
}
