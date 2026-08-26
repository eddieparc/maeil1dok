"""Resource handles and denial bodies for profile and social authorization."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from accounts.models import Follow, User, UserProfile

AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}

USER_NOT_FOUND = {
    "success": False,
    "message": "요청 처리 중 오류가 발생했습니다.",
    "error": "사용자를 찾을 수 없습니다.",
}

CANNOT_FOLLOW_SELF = {
    "success": False,
    "message": "요청 처리 중 오류가 발생했습니다.",
    "error": "자기 자신은 팔로우할 수 없습니다.",
}

FOLLOW_NOT_FOUND = {
    "success": False,
    "message": "요청 처리 중 오류가 발생했습니다.",
    "error": "팔로우 관계가 존재하지 않습니다.",
}


@dataclass(frozen=True)
class UserProfileResource:
    """ID handle for a target user's profile."""

    user_id: int
    resource_type: ClassVar[str] = "user_profile"


@dataclass(frozen=True)
class ProfileReadContext:
    user: User
    profile: UserProfile | None
    is_own_profile: bool


@dataclass(frozen=True)
class FollowTarget:
    """Directed follow edge: subject -> following_id."""

    following_id: int
    resource_type: ClassVar[str] = "user_profile"


@dataclass(frozen=True)
class FollowEdge:
    """Existing directed follow owned by the subject (follower)."""

    following_id: int
    resource_type: ClassVar[str] = "user_profile"


@dataclass(frozen=True)
class FriendsCollection:
    resource_type: ClassVar[str] = "user_profile"


@dataclass(frozen=True)
class ProfileSearch:
    resource_type: ClassVar[str] = "user_profile"


@dataclass(frozen=True)
class ProfileUpdate:
    resource_type: ClassVar[str] = "user_profile"
