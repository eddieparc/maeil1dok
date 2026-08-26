"""Resource handles and denial bodies for reading-group authorization."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from accounts.models import User
from todos.models import GroupInvitation, GroupMembership, ReadingGroup


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
GROUP_NOT_FOUND = {"success": False, "error": "그룹을 찾을 수 없습니다."}
USER_NOT_FOUND = {"success": False, "error": "사용자를 찾을 수 없습니다."}
DRF_NOT_FOUND = {"detail": "Not found."}
PRIVATE_NEEDS_INVITE = {
    "success": False,
    "error": "비공개 그룹은 초대가 필요합니다.",
}
GROUP_FULL = {"success": False, "error": "그룹이 가득 찼습니다."}
ALREADY_MEMBER = {"success": False, "error": "이미 그룹 멤버입니다."}
NOT_A_MEMBER = {"success": False, "error": "그룹 멤버가 아닙니다."}
CREATOR_CANNOT_LEAVE = {
    "success": False,
    "error": "그룹 생성자는 탈퇴할 수 없습니다.",
}
ADMIN_ONLY_INVITE = {"success": False, "error": "관리자만 초대할 수 있습니다."}
MEMBERS_ONLY_PROGRESS = {
    "success": False,
    "error": "그룹 멤버만 조회할 수 있습니다.",
}


@dataclass(frozen=True)
class ReadingGroupCollection:
    resource_type: ClassVar[str] = "reading_group"


@dataclass(frozen=True)
class ReadingGroupCreation:
    resource_type: ClassVar[str] = "reading_group"


@dataclass(frozen=True)
class ReadingGroupResource:
    group_id: int
    resource_type: ClassVar[str] = "reading_group"


@dataclass(frozen=True)
class ProfileGroupsQuery:
    user_id: int
    resource_type: ClassVar[str] = "reading_group"


@dataclass(frozen=True)
class ReadingGroupMembershipResource:
    group_id: int
    resource_type: ClassVar[str] = "reading_group_membership"


@dataclass(frozen=True)
class MembershipProfileVisibility:
    """Actual target of `group-visibility`: this member's show_in_profile."""

    group_id: int
    resource_type: ClassVar[str] = "reading_group_membership"


@dataclass(frozen=True)
class GroupInvitationCollection:
    resource_type: ClassVar[str] = "group_invitation"


@dataclass(frozen=True)
class GroupInvitationResource:
    invitation_id: int
    resource_type: ClassVar[str] = "group_invitation"


@dataclass(frozen=True)
class GroupScoreboardResource:
    group_id: int
    resource_type: ClassVar[str] = "scoreboard"


@dataclass(frozen=True)
class JoinContext:
    group: ReadingGroup
    membership: GroupMembership | None
    pending_invitation: GroupInvitation | None


@dataclass(frozen=True)
class ProfileGroupsContext:
    user: User
    is_own_profile: bool
