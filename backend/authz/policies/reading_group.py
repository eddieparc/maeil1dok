"""Reading-group authorization.

Creator identity (`group.creator_id`) and active membership role
(`membership.role == 'admin'`) are separate sources of truth. They
coincide at group creation but are not kept in sync. This policy
preserves that split; it does not unify them.

`group-visibility` mutates the current member's `show_in_profile`,
not the group's `is_public`.
"""

from __future__ import annotations

from django.db.models import Q

from accounts.models import User, UserProfile
from accounts.visibility import is_live_user
from authz.core import Decision
from authz.policies.reading_group_types import (
    ADMIN_ONLY_INVITE,
    ALREADY_MEMBER,
    AUTHENTICATION_REQUIRED,
    CREATOR_CANNOT_LEAVE,
    DRF_NOT_FOUND,
    GROUP_FULL,
    GROUP_NOT_FOUND,
    GroupInvitationCollection,
    GroupInvitationResource,
    GroupScoreboardResource,
    JoinContext,
    MEMBERS_ONLY_PROGRESS,
    MembershipProfileVisibility,
    NOT_A_MEMBER,
    PRIVATE_NEEDS_INVITE,
    ProfileGroupsContext,
    ProfileGroupsQuery,
    ReadingGroupCollection,
    ReadingGroupCreation,
    ReadingGroupMembershipResource,
    ReadingGroupResource,
    USER_NOT_FOUND,
)
from todos.models import GroupInvitation, GroupMembership, ReadingGroup

__all__ = [
    "GroupInvitationCollection",
    "GroupInvitationResource",
    "GroupScoreboardResource",
    "JoinContext",
    "MembershipProfileVisibility",
    "ProfileGroupsContext",
    "ProfileGroupsQuery",
    "ReadingGroupCollection",
    "ReadingGroupCreation",
    "ReadingGroupMembershipResource",
    "ReadingGroupResource",
]


def _load_group(group_id):
    return ReadingGroup.objects.filter(pk=group_id).first()


def _active_membership(group, user_id):
    if user_id is None:
        return None
    return GroupMembership.objects.filter(
        group=group,
        user_id=user_id,
        is_active=True,
    ).first()


def _creator_is_subject(group, subject):
    """Creator relation. Leave prohibition uses this, not membership.role.

    Divergence: a creator whose admin membership was revoked still cannot
    leave; a non-creator admin can invite but is not blocked from leaving.
    """
    return subject.is_authenticated and group.creator_id == subject.user_id


def _active_admin_membership(group, subject):
    """Active membership.role == 'admin'. Invite uses this, not creator.

    See `_creator_is_subject`: the two sources of truth are not synced
    after group creation.
    """
    membership = _active_membership(group, subject.user_id)
    if membership is None or membership.role != "admin":
        return None
    return membership


def _group_visible(group, subject):
    if group.is_public:
        return True
    return _active_membership(group, subject.user_id) is not None


def _hidden_or_missing_group(group, subject):
    if group is None or not _group_visible(group, subject):
        return Decision.deny(404, GROUP_NOT_FOUND)
    return Decision.allow(group)


def _list_groups(subject, resource):
    del resource
    if not subject.is_authenticated:
        groups = ReadingGroup.objects.filter(is_public=True)
    else:
        groups = ReadingGroup.objects.filter(
            Q(is_public=True)
            | Q(
                memberships__user_id=subject.user_id,
                memberships__is_active=True,
            )
        ).distinct()
    return Decision.allow(groups)


def _create_group(subject, resource):
    del resource
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow()


def _view_group(subject, resource):
    return _hidden_or_missing_group(_load_group(resource.group_id), subject)


def _join(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    group = _load_group(resource.group_id)
    if group is None:
        return Decision.deny(404, GROUP_NOT_FOUND)

    membership = GroupMembership.objects.filter(
        group=group,
        user_id=subject.user_id,
    ).first()
    if membership is not None and membership.is_active:
        return Decision.deny(400, ALREADY_MEMBER)

    pending_invitation = None
    if not group.is_public:
        pending_invitation = GroupInvitation.objects.filter(
            group=group,
            invitee_id=subject.user_id,
            status="pending",
        ).first()
        if membership is None and pending_invitation is None:
            return Decision.deny(404, GROUP_NOT_FOUND)
        if pending_invitation is None:
            return Decision.deny(403, PRIVATE_NEEDS_INVITE)

    if group.is_full:
        return Decision.deny(400, GROUP_FULL)
    return Decision.allow(
        JoinContext(
            group=group,
            membership=membership,
            pending_invitation=pending_invitation,
        )
    )


def _leave(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    group = _load_group(resource.group_id)
    if group is None:
        return Decision.deny(404, GROUP_NOT_FOUND)

    membership = _active_membership(group, subject.user_id)
    if membership is None:
        if not group.is_public:
            return Decision.deny(404, GROUP_NOT_FOUND)
        return Decision.deny(400, NOT_A_MEMBER)
    if _creator_is_subject(group, subject):
        return Decision.deny(400, CREATOR_CANNOT_LEAVE)
    return Decision.allow(membership)


def _invite(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    group = _load_group(resource.group_id)
    if group is None:
        return Decision.deny(404, GROUP_NOT_FOUND)
    if _active_admin_membership(group, subject) is None:
        if not group.is_public:
            return Decision.deny(404, GROUP_NOT_FOUND)
        return Decision.deny(403, ADMIN_ONLY_INVITE)
    return Decision.allow(group)


def _view_group_members(subject, resource):
    return _hidden_or_missing_group(_load_group(resource.group_id), subject)


def _view_member_progress(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    group = _load_group(resource.group_id)
    if group is None:
        return Decision.deny(404, GROUP_NOT_FOUND)
    if _active_membership(group, subject.user_id) is None:
        if not group.is_public:
            return Decision.deny(404, GROUP_NOT_FOUND)
        return Decision.deny(403, MEMBERS_ONLY_PROGRESS)
    return Decision.allow(group)


def _update_profile_visibility(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    membership = GroupMembership.objects.filter(
        group_id=resource.group_id,
        user_id=subject.user_id,
        is_active=True,
    ).first()
    if membership is None:
        return Decision.deny(404, DRF_NOT_FOUND)
    return Decision.allow(membership)


def _view_profile_groups(subject, resource):
    user = User.objects.filter(id=resource.user_id).first()
    if user is None or not is_live_user(user):
        return Decision.deny(404, USER_NOT_FOUND)
    profile = UserProfile.objects.filter(user=user).first()
    is_own_profile = subject.is_authenticated and subject.user_id == user.id
    if profile is not None and not profile.is_public and not is_own_profile:
        return Decision.deny(404, USER_NOT_FOUND)
    return Decision.allow(
        ProfileGroupsContext(user=user, is_own_profile=is_own_profile)
    )


def _view_invitations(subject, resource):
    del resource
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        GroupInvitation.objects.filter(
            invitee_id=subject.user_id,
            status="pending",
        )
        .select_related("group__creator__profile", "inviter")
        .order_by("-created_at")
    )


def _respond_invitation(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    invitation = GroupInvitation.objects.filter(
        pk=resource.invitation_id,
        invitee_id=subject.user_id,
        status="pending",
    ).first()
    if invitation is None:
        return Decision.deny(404, GROUP_NOT_FOUND)
    return Decision.allow(invitation)


def _view_group_scoreboard(subject, resource):
    return _hidden_or_missing_group(_load_group(resource.group_id), subject)


POLICIES = {
    ("list_groups", ReadingGroupCollection): _list_groups,
    ("create_group", ReadingGroupCreation): _create_group,
    ("view_group", ReadingGroupResource): _view_group,
    ("join", ReadingGroupResource): _join,
    ("leave", ReadingGroupResource): _leave,
    ("invite", ReadingGroupResource): _invite,
    ("view_profile_groups", ProfileGroupsQuery): _view_profile_groups,
    ("view_group_members", ReadingGroupMembershipResource): _view_group_members,
    ("view_member_progress", ReadingGroupMembershipResource): _view_member_progress,
    ("update_profile_visibility", MembershipProfileVisibility): (
        _update_profile_visibility
    ),
    ("view_invitations", GroupInvitationCollection): _view_invitations,
    ("respond_invitation", GroupInvitationResource): _respond_invitation,
    ("view_group_scoreboard", GroupScoreboardResource): _view_group_scoreboard,
}
