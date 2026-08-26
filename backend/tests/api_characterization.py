"""HTTP-boundary characterization support for the production URLconf."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.urls import URLPattern, URLResolver, get_resolver
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from tests.characterization_exclusions import EXCLUDED_ROUTES


GOLDEN_PATH = Path(__file__).with_name("golden") / "api_characterization.json"
PERSONAS = ("anonymous", "owner", "non_owner")
METHOD_PRIORITY = ("GET", "POST", "PATCH", "PUT", "DELETE")


@dataclass(frozen=True)
class Route:
    pattern: str
    name: str
    callback: object


class UnmaterializedRouteError(AssertionError):
    pass


def enumerate_routes(patterns=None, prefix=""):
    """Return every leaf URLPattern registered in the active URLconf."""
    if patterns is None:
        patterns = get_resolver().url_patterns

    routes = []
    for pattern in patterns:
        full_pattern = f"{prefix}{pattern.pattern}"
        if isinstance(pattern, URLResolver):
            routes.extend(enumerate_routes(pattern.url_patterns, full_pattern))
        elif isinstance(pattern, URLPattern):
            routes.append(Route(full_pattern, pattern.name or "<unnamed>", pattern.callback))
    return sorted(routes, key=lambda route: route.pattern)


def allowed_method(callback):
    actions = getattr(callback, "actions", None)
    if actions:
        allowed = {method.upper() for method in actions}
    else:
        view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
        if view_class is None:
            allowed = {"GET"}
        else:
            initkwargs = getattr(callback, "initkwargs", {})
            view = view_class(**initkwargs)
            allowed = set(view._allowed_methods())

    for method in METHOD_PRIORITY:
        if method in allowed:
            return method
    raise UnmaterializedRouteError(f"No supported characterization method for {callback!r}: {sorted(allowed)}")


def _parameter_value(route, parameter, fixture_ids):
    if parameter == "format":
        return "json"
    if parameter == "user_id":
        return fixture_ids["owner"]
    if parameter == "notification_id":
        return fixture_ids["notification"]
    if parameter == "group_id":
        return fixture_ids["private_group"]
    if parameter == "invitation_id":
        return fixture_ids["invitation"]
    if parameter == "subscription_id":
        return fixture_ids["subscription"]
    if parameter == "session_id":
        return fixture_ids["catchup_session"]
    if parameter == "schedule_id":
        return fixture_ids["catchup_schedule"]
    if parameter == "video_id":
        return fixture_ids["hasena_summary_video_id"]
    if parameter == "version":
        return "GAE"
    if parameter == "book":
        return "gen"
    if parameter == "chapter":
        return 1
    if parameter == "pk":
        resource_by_name = {
            "biblereadingplan-detail": "plan",
            "biblereadingplan-schedules": "plan",
            "biblereadingplan-set-default": "plan",
            "biblereadingplan-toggle-active": "plan",
            "bible-bookmark-detail": "bookmark",
            "reflection-note-detail": "reflection_note",
            "bible-highlight-detail": "highlight",
            "schedule-detail": "daily_schedule",
            "plan-subscription-detail": "subscription",
            "plan-subscription-toggle-active": "subscription",
            "video-intro-detail": "video_intro",
            "calendar-setting-detail": "calendar_setting",
        }
        fixture_key = resource_by_name.get(route.name)
        if fixture_key:
            return fixture_ids[fixture_key]

    raise UnmaterializedRouteError(
        f"Route {route.pattern!r} ({route.name}) has no fixture for parameter {parameter!r}. "
        "Add a deterministic fixture or an explicit exclusion with a reason."
    )


def materialize_path(route, fixture_ids):
    """Convert RoutePattern and DRF RegexPattern syntax to a callable path."""
    path = route.pattern

    def replace_angle(match):
        value = str(_parameter_value(route, match.group("name"), fixture_ids))
        if match.group("converter") == "drf_format_suffix":
            return f".{value}"
        return value

    def replace_regex(match):
        return str(_parameter_value(route, match.group("name"), fixture_ids))

    path = re.sub(
        r"\(\?P<(?P<name>[A-Za-z_][A-Za-z0-9_]*)>[^)]+\)",
        replace_regex,
        path,
    )
    path = re.sub(
        r"<(?:(?P<converter>[^:>]+):)?(?P<name>[A-Za-z_][A-Za-z0-9_]*)>",
        replace_angle,
        path,
    )
    path = path.replace("/^", "/").rstrip("$")
    path = path.replace(r"\.", ".").replace("/?", "/").replace("\\", "")
    path = path.lstrip("^")
    return f"/{path}"


def _queries(fixture_ids):
    plan_id = fixture_ids["plan"]
    return {
        "get_user_calendar": {"year": 2026, "month": 1},
        "search_users": {"q": "characterization"},
        "bible-bookmark-by-chapter": {"book": "gen", "chapter": 1},
        "reflection-note-by-chapter": {"book": "gen", "chapter": 1},
        "bible-highlight-by-chapter": {"book": "gen", "chapter": 1},
        "personal-record-by-book": {"book": "gen"},
        "schedules-month": {"year": 2026, "month": 1, "plan_id": plan_id},
        "schedules-today": {"plan_id": plan_id},
        "certification-progress": {"plan_id": plan_id, "year": 2026},
        "chapter-detail": {"plan_id": plan_id, "book": "gen", "chapter": 1},
        "next-reading-position": {"plan_id": plan_id},
        "video-intro-list": {"plan_id": plan_id},
        "user-video-intros": {"plan_id": plan_id},
        "hasena-record-list": {"year": 2026, "month": 1},
        "hasena-day": {"date": "2026-01-15"},
        "hasena-calendar": {"year": 2026, "month": 1},
        "hasena-summary": {"video_id": fixture_ids["hasena_summary_video_id"]},
        "plan-stats": {"plan_id": plan_id},
        "progress-stats": {"plan_id": plan_id},
        "scoreboard": {"plan_id": plan_id, "period": "all", "limit": 20},
        "friends-scoreboard": {"plan_id": plan_id, "period": "all"},
        "group-scoreboard": {"plan_id": plan_id, "period": "all"},
        "my-ranking": {"plan_id": plan_id, "period": "all"},
        "group-member-progress": {"plan_id": plan_id, "year": 2026, "month": 1},
        "calendar-month": {"year": 2026, "month": 1},
        "catchup-session-schedules": {"date": "2026-01-20"},
        "bible-home-stats": {"recent_limit": 5},
        "bible-cache-search": {"q": "characterization", "version": "GAE"},
    }


def _payloads(fixture_ids):
    password = fixture_ids["password"]
    return {
        "token_obtain_pair": {"username": fixture_ids["owner_username"], "password": password},
        "login": {"username": fixture_ids["owner_username"], "password": password},
        "token_refresh": {"refresh": "invalid-characterization-refresh"},
        "token_refresh_legacy": {"refresh": "invalid-characterization-refresh"},
        "register": {
            "username": "characterization-new-user",
            "nickname": "characterization-new-nickname",
            "password": "Characterization123!",
        },
        "check_username": {"username": fixture_ids["owner_username"]},
        "check_nickname": {"nickname": fixture_ids["owner_nickname"]},
        "update_user_profile": {"bio": "characterization bio", "is_public": True},
        "follow_user": {"user_id": fixture_ids["owner"]},
        "update_reading_settings": {"theme": "dark", "font_size": 18},
        "email_register": {
            "email": "characterization-new@example.com",
            "password": "Characterization123!",
            "password_confirm": "Characterization123!",
            "nickname": "characterization-email-new",
        },
        "email_login": {"email": fixture_ids["owner_email"], "password": password},
        "unlink_social_account": {"provider": "kakao"},
        "set_password": {
            "current_password": password,
            "new_password": "Characterization456!",
            "new_password_confirm": "Characterization456!",
        },
        "send_verification_email": {"email": fixture_ids["owner_email"]},
        "verify_email": {"token": fixture_ids["email_verification_token"]},
        "request_password_reset": {"email": fixture_ids["owner_email"]},
        "verify_reset_token": {"token": fixture_ids["password_reset_token"]},
        "reset_password": {
            "token": fixture_ids["password_reset_token"],
            "new_password": "Characterization789!",
        },
        "delete_account": {"password": password, "confirm_delete": True},
        "biblereadingplan-set-default": {},
        "biblereadingplan-toggle-active": {},
        "update_bible_progress": {
            "subscription_id": fixture_ids["subscription"],
            "schedule_ids": [fixture_ids["daily_schedule"]],
            "is_completed": True,
        },
        "notification-settings": {},
        "notification-push-register": {
            "endpoint": "https://fcm.googleapis.com/characterization",
            "keys": {"p256dh": "characterization-p256dh", "auth": "characterization-auth"},
        },
        "notification-push-remove": {"endpoint": "https://fcm.googleapis.com/characterization"},
        "plan-subscription-toggle-active": {},
        "update-video-intro-progress": {
            "video_intro_id": fixture_ids["video_intro"],
            "is_completed": True,
        },
        "hasena-record-update": {"date": "2026-01-15", "is_completed": True},
        "hasena-summary-regenerate": {"video_id": fixture_ids["hasena_summary_video_id"]},
        "hasena-summary-update": {"summary": "Updated characterization summary"},
        "create-group": {
            "name": "Characterization group created through HTTP",
            "plan_ids": [fixture_ids["plan"]],
            "is_public": True,
        },
        "join-group": {},
        "leave-group": {},
        "invite-to-group": {"user_id": fixture_ids["support_user"], "message": "Join us"},
        "respond-invitation": {"action": "decline"},
        "group-visibility": {"show_in_profile": False},
        "calendar-setting-detail": {"color": "#112233", "is_visible": False},
        "calendar-settings-reorder": {
            "orders": [{"id": fixture_ids["calendar_setting"], "display_order": 3}]
        },
        "catchup-preview": {},
        "catchup-create": {
            "name": "Characterization catchup",
            "range_start": "2026-01-15",
            "range_end": "2026-01-15",
            "strategy": "parallel",
        },
        "catchup-session-update": {"name": "Updated characterization catchup"},
        "catchup-schedule-toggle": {},
        "catchup-session-complete": {},
        "catchup-session-abandon": {},
    }


def request_arguments(route, fixture_ids):
    path = materialize_path(route, fixture_ids)
    query = _queries(fixture_ids).get(route.name)
    if query:
        path = f"{path}?{urlencode(sorted(query.items()))}"
    return path, _payloads(fixture_ids).get(route.name, {})


_ID_KEYS = {
    "created_by",
    "plan",
    "schedule",
    "subscription",
    "user",
}
_DATE_VALUE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME_VALUE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]")
_UUID_VALUE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)


def _normalized_key(key):
    key = str(key)
    if _DATE_VALUE.fullmatch(key):
        return "<date-key>"
    if key.isdigit():
        return "<id-key>"
    if _UUID_VALUE.fullmatch(key):
        return "<uuid-key>"
    return key


def _semantic_placeholder(key, value):
    normalized_key = re.sub(r"[^a-z0-9_]", "", str(key or "").lower())
    if normalized_key == "id" or normalized_key.endswith("_id") or normalized_key in _ID_KEYS:
        return "<id>"
    if normalized_key.endswith("_ids"):
        return "<ids>"
    if any(part in normalized_key for part in ("token", "access", "refresh", "state")):
        return "<token>"
    if isinstance(value, str):
        if _UUID_VALUE.fullmatch(value):
            return "<uuid>"
        if _DATETIME_VALUE.match(value):
            return "<datetime>"
        if _DATE_VALUE.fullmatch(value):
            return "<date>"
    return None


def response_shape(value, key=None):
    placeholder = _semantic_placeholder(key, value)
    if placeholder:
        return placeholder
    if value is None:
        return "<null>"
    if isinstance(value, bool):
        return "<boolean>"
    if isinstance(value, int):
        return "<integer>"
    if isinstance(value, float):
        return "<number>"
    if isinstance(value, str):
        return "<string>"
    if isinstance(value, dict):
        normalized = {}
        for child_key in sorted(value, key=str):
            shape = response_shape(value[child_key], child_key)
            normalized_child_key = _normalized_key(child_key)
            existing = normalized.get(normalized_child_key)
            if existing is None or existing == shape:
                normalized[normalized_child_key] = shape
            else:
                variants = sorted(
                    {json.dumps(existing, sort_keys=True), json.dumps(shape, sort_keys=True)}
                )
                normalized[normalized_child_key] = {
                    "type": "union",
                    "variants": [json.loads(variant) for variant in variants],
                }
        return normalized
    if isinstance(value, (list, tuple)):
        unique_shapes = {
            json.dumps(response_shape(item, key), ensure_ascii=False, sort_keys=True)
            for item in value
        }
        return {
            "type": "list",
            "length": len(value),
            "element_shapes": [json.loads(shape) for shape in sorted(unique_shapes)],
        }
    return f"<{type(value).__name__}>"


def _response_data(response):
    if hasattr(response, "data"):
        return response.data
    try:
        return response.json()
    except (TypeError, ValueError):
        return response.content.decode("utf-8", errors="replace")


def _access_token(user):
    token = AccessToken.for_user(user)
    token["token_version"] = user.token_version
    return str(token)


def persona_clients(owner, non_owner):
    anonymous = APIClient()
    owner_client = APIClient()
    owner_client.credentials(HTTP_AUTHORIZATION=f"Bearer {_access_token(owner)}")
    non_owner_client = APIClient()
    non_owner_client.credentials(HTTP_AUTHORIZATION=f"Bearer {_access_token(non_owner)}")
    for client in (anonymous, owner_client, non_owner_client):
        client.raise_request_exception = False
    return {
        "anonymous": anonymous,
        "owner": owner_client,
        "non_owner": non_owner_client,
    }


def _request_with_database_rollback(client, method, path, payload):
    try:
        with transaction.atomic():
            response = client.generic(
                method,
                path,
                data=json.dumps(payload),
                content_type="application/json",
            )
            transaction.set_rollback(True)
        return response
    finally:
        # Login/logout, sessions, explicit throttles, and cached scoreboards must
        # not leak state into the next route or persona observation.
        client.cookies.clear()
        cache.clear()


def capture_characterization(owner, non_owner, fixture_ids):
    cache.clear()
    clients = persona_clients(owner, non_owner)
    routes = enumerate_routes()

    unknown_exclusions = sorted(set(EXCLUDED_ROUTES) - {route.pattern for route in routes})
    if unknown_exclusions:
        raise AssertionError(f"Exclusion entries no longer match URLconf routes: {unknown_exclusions}")

    excluded = {}
    captured = {}
    for route in routes:
        reason = EXCLUDED_ROUTES.get(route.pattern)
        if reason:
            excluded[route.pattern] = {"name": route.name, "reason": reason}
            continue

        method = allowed_method(route.callback)
        path, payload = request_arguments(route, fixture_ids)
        personas = {}
        for persona in PERSONAS:
            response = _request_with_database_rollback(
                clients[persona], method, path, payload
            )
            observation = {"status": response.status_code}
            if response.status_code == 200:
                observation["shape"] = response_shape(_response_data(response))
            personas[persona] = observation

        captured[route.pattern] = {
            "name": route.name,
            "method": method,
            "personas": personas,
        }

    return {
        "_meta": {
            "schema_version": 1,
            "route_count": len(routes),
            "covered_route_count": len(captured),
            "excluded_route_count": len(excluded),
            "personas": list(PERSONAS),
        },
        "excluded": excluded,
        "routes": captured,
    }


def create_characterization_fixtures():
    """Create deterministic rows directly through the ORM; observations remain HTTP-only."""
    User = get_user_model()
    model = lambda name: apps.get_model("todos", name)
    account_model = lambda name: apps.get_model("accounts", name)

    password = "Characterization123!"
    owner = User.objects.create_user(
        username="characterization-owner",
        nickname="characterization-owner-nickname",
        email="characterization-owner@example.com",
        password=password,
        has_usable_password_flag=True,
    )
    non_owner = User.objects.create_user(
        username="characterization-non-owner",
        nickname="characterization-non-owner-nickname",
        email="characterization-non-owner@example.com",
        password=password,
        has_usable_password_flag=True,
    )
    support_user = User.objects.create_user(
        username="characterization-support",
        nickname="characterization-support-nickname",
        email="characterization-support@example.com",
        password=password,
        has_usable_password_flag=True,
    )

    BibleReadingPlan = model("BibleReadingPlan")
    PlanSubscription = model("PlanSubscription")
    DailyBibleSchedule = model("DailyBibleSchedule")
    UserBibleProgress = model("UserBibleProgress")
    VideoBibleIntro = model("VideoBibleIntro")
    UserVideoIntroProgress = model("UserVideoIntroProgress")
    HasenaRecord = model("HasenaRecord")
    HasenaSummary = model("HasenaSummary")
    HasenaEntry = model("HasenaEntry")
    NotificationSettings = model("NotificationSettings")
    Notification = model("Notification")
    ReadingGroup = model("ReadingGroup")
    GroupMembership = model("GroupMembership")
    GroupInvitation = model("GroupInvitation")
    UserReadingPosition = model("UserReadingPosition")
    BibleBookmark = model("BibleBookmark")
    ReflectionNote = model("ReflectionNote")
    BibleHighlight = model("BibleHighlight")
    PersonalReadingRecord = model("PersonalReadingRecord")
    CatchupSession = model("CatchupSession")
    CatchupSchedule = model("CatchupSchedule")

    owner_plan = BibleReadingPlan.objects.create(
        name="Characterization owner plan",
        description="Owner-visible plan",
        created_by=owner,
        is_active=True,
    )
    non_owner_plan = BibleReadingPlan.objects.create(
        name="Characterization non-owner plan",
        description="Non-owner-visible plan",
        created_by=non_owner,
        is_active=True,
    )
    owner_subscription = PlanSubscription.objects.create(
        user=owner,
        plan=owner_plan,
        start_date=date(2026, 1, 1),
        is_active=True,
    )
    non_owner_subscription = PlanSubscription.objects.create(
        user=non_owner,
        plan=non_owner_plan,
        start_date=date(2026, 1, 1),
        is_active=True,
    )

    owner_schedule = DailyBibleSchedule.objects.create(
        plan=owner_plan,
        date=date(2026, 1, 15),
        book="창세기",
        start_chapter=1,
        end_chapter=2,
        audio_link="https://example.com/audio-owner",
        guide_link="https://example.com/guide-owner",
    )
    non_owner_schedule = DailyBibleSchedule.objects.create(
        plan=non_owner_plan,
        date=date(2026, 1, 15),
        book="창세기",
        start_chapter=1,
        end_chapter=2,
        audio_link="https://example.com/audio-non-owner",
        guide_link="https://example.com/guide-non-owner",
    )
    owner_today_schedule = DailyBibleSchedule.objects.create(
        plan=owner_plan,
        date=timezone.now().date(),
        book="출애굽기",
        start_chapter=3,
        end_chapter=3,
    )
    DailyBibleSchedule.objects.create(
        plan=non_owner_plan,
        date=timezone.now().date(),
        book="출애굽기",
        start_chapter=3,
        end_chapter=3,
    )
    UserBibleProgress.objects.create(
        subscription=owner_subscription,
        schedule=owner_schedule,
        is_completed=True,
        completed_at=timezone.now(),
    )
    UserBibleProgress.objects.create(
        subscription=non_owner_subscription,
        schedule=non_owner_schedule,
        is_completed=True,
        completed_at=timezone.now(),
    )

    owner_video = VideoBibleIntro.objects.create(
        plan=owner_plan,
        book="창세기",
        url_link="https://example.com/video-owner",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )
    non_owner_video = VideoBibleIntro.objects.create(
        plan=non_owner_plan,
        book="창세기",
        url_link="https://example.com/video-non-owner",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )
    UserVideoIntroProgress.objects.create(
        user=owner,
        video_intro=owner_video,
        is_completed=True,
        completed_at=timezone.now(),
    )
    UserVideoIntroProgress.objects.create(
        user=non_owner,
        video_intro=non_owner_video,
        is_completed=True,
        completed_at=timezone.now(),
    )

    owner_hasena = HasenaRecord.objects.create(user=owner, date=date(2026, 1, 15), is_completed=True)
    HasenaRecord.objects.create(user=non_owner, date=date(2026, 1, 15), is_completed=True)
    HasenaEntry.objects.create(
        date=date(2026, 1, 15),
        video_id="fixture-entry-video",
        title="Characterization Hasena entry",
        passage="Genesis 1:1",
        body_text="Characterization body",
        verses=[{"verse": 1, "text": "Characterization verse"}],
        source_url="https://example.com/hasena",
    )
    summary_video_id = "fixture-summary-video"
    HasenaSummary.objects.create(
        video_id=summary_video_id,
        video_date=date(2026, 1, 15),
        title="Characterization summary",
        summary="Characterization summary body",
        transcript="Characterization transcript",
    )

    for user in (owner, non_owner):
        NotificationSettings.objects.create(
            user=user,
            reading_reminders_enabled=False,
            hasena_reminders_enabled=False,
        )
    owner_notification = Notification.objects.create(
        recipient=owner,
        actor=support_user,
        type="friend_activity",
        title="Characterization notification",
        body="Characterization notification body",
        target_url="/friends",
        data={"actor_id": support_user.id},
        dedupe_key="characterization-owner-notification",
    )
    Notification.objects.create(
        recipient=non_owner,
        actor=support_user,
        type="friend_activity",
        title="Characterization notification",
        body="Characterization notification body",
        target_url="/friends",
        data={"actor_id": support_user.id},
        dedupe_key="characterization-non-owner-notification",
    )

    public_group = ReadingGroup.objects.create(
        name="Characterization public group",
        creator=owner,
        is_public=True,
    )
    public_group.plans.add(owner_plan)
    GroupMembership.objects.create(group=public_group, user=owner, role="admin")
    private_group = ReadingGroup.objects.create(
        name="Characterization private group",
        creator=owner,
        is_public=False,
    )
    private_group.plans.add(owner_plan)
    GroupMembership.objects.create(group=private_group, user=owner, role="admin")
    invitation_group = ReadingGroup.objects.create(
        name="Characterization invitation group",
        creator=non_owner,
        is_public=True,
    )
    invitation_group.plans.add(non_owner_plan)
    GroupMembership.objects.create(group=invitation_group, user=non_owner, role="admin")
    invitation = GroupInvitation.objects.create(
        group=invitation_group,
        inviter=non_owner,
        invitee=owner,
        status="pending",
        message="Characterization invitation",
    )

    Follow = account_model("Follow")
    Follow.objects.create(follower=owner, following=support_user)
    Follow.objects.create(follower=support_user, following=owner)
    Follow.objects.create(follower=non_owner, following=support_user)
    Follow.objects.create(follower=support_user, following=non_owner)
    account_model("SocialAccount").objects.create(
        user=owner,
        provider="kakao",
        provider_id="characterization-owner-provider",
        email=owner.email,
    )
    account_model("SocialAccount").objects.create(
        user=non_owner,
        provider="kakao",
        provider_id="characterization-non-owner-provider",
        email=non_owner.email,
    )
    account_model("UserReadingSettings").objects.create(user=owner)
    account_model("UserReadingSettings").objects.create(user=non_owner)

    owner_position = UserReadingPosition.objects.create(
        user=owner,
        book="gen",
        chapter=1,
        verse=1,
        scroll_position=0.25,
        version="GAE",
    )
    UserReadingPosition.objects.create(
        user=non_owner,
        book="gen",
        chapter=1,
        verse=1,
        scroll_position=0.25,
        version="GAE",
    )
    del owner_position

    owner_bookmark = BibleBookmark.objects.create(
        user=owner,
        bookmark_type="verse",
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        title="Characterization bookmark",
        memo="Bookmark memo",
    )
    BibleBookmark.objects.create(
        user=non_owner,
        bookmark_type="verse",
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        title="Characterization bookmark",
        memo="Bookmark memo",
    )
    owner_note = ReflectionNote.objects.create(
        user=owner,
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        content="Characterization reflection",
    )
    ReflectionNote.objects.create(
        user=non_owner,
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        content="Characterization reflection",
    )
    owner_highlight = BibleHighlight.objects.create(
        user=owner,
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        memo="Characterization highlight",
    )
    BibleHighlight.objects.create(
        user=non_owner,
        book="gen",
        chapter=1,
        start_verse=1,
        end_verse=2,
        memo="Characterization highlight",
    )
    owner_record = PersonalReadingRecord.objects.create(
        user=owner,
        book="gen",
        chapter=1,
        read_date=date(2026, 1, 15),
    )
    PersonalReadingRecord.objects.create(
        user=non_owner,
        book="gen",
        chapter=1,
        read_date=date(2026, 1, 15),
    )

    owner_session = CatchupSession.objects.create(
        subscription=owner_subscription,
        name="Characterization owner catchup",
        range_start=date(2026, 1, 15),
        range_end=date(2026, 1, 15),
        strategy="parallel",
        max_daily_readings=1,
        weekend_multiplier=Decimal("1.0"),
    )
    non_owner_session = CatchupSession.objects.create(
        subscription=non_owner_subscription,
        name="Characterization non-owner catchup",
        range_start=date(2026, 1, 15),
        range_end=date(2026, 1, 15),
        strategy="parallel",
        max_daily_readings=1,
        weekend_multiplier=Decimal("1.0"),
    )
    owner_catchup_schedule = CatchupSchedule.objects.create(
        session=owner_session,
        original_schedule=owner_schedule,
        scheduled_date=date(2026, 1, 20),
    )
    CatchupSchedule.objects.create(
        session=non_owner_session,
        original_schedule=non_owner_schedule,
        scheduled_date=date(2026, 1, 20),
    )

    email_token = "characterization-email-verification-token"
    reset_token = "characterization-password-reset-token"
    expiry = timezone.now() + timedelta(days=1)
    account_model("EmailVerificationToken").objects.create(
        user=owner,
        token=email_token,
        email=owner.email,
        expires_at=expiry,
    )
    account_model("PasswordResetToken").objects.create(
        user=owner,
        token=reset_token,
        expires_at=expiry,
    )

    BibleContentCache = apps.get_model("bible_cache", "BibleContentCache")
    BibleContentCache.objects.create(
        cache_key="GAE:gen:1",
        version="GAE",
        book="gen",
        chapter=1,
        content=json.dumps({"verses": [{"verse": 1, "text": "Characterization cached verse"}]}),
        content_type="json",
        source_url="https://example.com/bible",
        fetch_success=True,
    )

    calendar_setting = owner_subscription.display_settings
    return owner, non_owner, {
        "password": password,
        "owner": owner.id,
        "owner_username": owner.username,
        "owner_nickname": owner.nickname,
        "owner_email": owner.email,
        "support_user": support_user.id,
        "plan": owner_plan.id,
        "subscription": owner_subscription.id,
        "daily_schedule": owner_schedule.id,
        "today_schedule": owner_today_schedule.id,
        "video_intro": owner_video.id,
        "hasena_record": owner_hasena.id,
        "hasena_summary_video_id": summary_video_id,
        "notification": owner_notification.id,
        "private_group": private_group.id,
        "invitation": invitation.id,
        "calendar_setting": calendar_setting.id,
        "bookmark": owner_bookmark.id,
        "reflection_note": owner_note.id,
        "highlight": owner_highlight.id,
        "personal_record": owner_record.id,
        "catchup_session": owner_session.id,
        "catchup_schedule": owner_catchup_schedule.id,
        "email_verification_token": email_token,
        "password_reset_token": reset_token,
    }
