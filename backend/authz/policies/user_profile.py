"""Authorization policies for profile and social graph domains.

Public profiles are readable by anyone, including anonymous subjects.
Private or missing profiles are hidden with 404 — the same existence-hiding
contract the views already expose. `/api/v1/auth/*` and `/api/v1/accounts/*`
share these actions via one registry policy key.

Follow is directional: `FollowTarget(following_id)` is subject → target.
`view_followers` lists incoming edges; `view_following` lists outgoing edges.
"""

from __future__ import annotations

from django.db.models import Q

from accounts.models import Follow, User, UserProfile
from accounts.visibility import is_live_user, live_user_filter
from authz.core import Decision
from authz.policies.user_profile_types import (
    AUTHENTICATION_REQUIRED,
    CANNOT_FOLLOW_SELF,
    FOLLOW_NOT_FOUND,
    FollowEdge,
    FollowTarget,
    FriendsCollection,
    ProfileReadContext,
    ProfileSearch,
    ProfileUpdate,
    USER_NOT_FOUND,
    UserProfileResource,
)

__all__ = [
    "FollowEdge",
    "FollowTarget",
    "FriendsCollection",
    "ProfileReadContext",
    "ProfileSearch",
    "ProfileUpdate",
    "UserProfileResource",
]


def _visible_users_q(subject):
    public_or_self = Q(profile__is_public=True)
    if subject.is_authenticated:
        public_or_self |= Q(id=subject.user_id)
    return live_user_filter() & public_or_self


def _load_readable_profile(subject, user_id):
    user = User.objects.filter(id=user_id).first()
    if user is None or not is_live_user(user):
        return Decision.deny(404, USER_NOT_FOUND)
    is_own_profile = subject.is_authenticated and subject.user_id == user.id
    if is_own_profile:
        profile = UserProfile.objects.filter(user=user).first()
        return Decision.allow(
            ProfileReadContext(user=user, profile=profile, is_own_profile=True)
        )
    profile = UserProfile.objects.filter(user=user).first()
    # Load-bearing public check: private profiles stay hidden (404).
    if profile is None or not profile.is_public:
        return Decision.deny(404, USER_NOT_FOUND)
    return Decision.allow(
        ProfileReadContext(user=user, profile=profile, is_own_profile=False)
    )


def _view_profile(subject, resource):
    return _load_readable_profile(subject, resource.user_id)


def _view_profile_calendar(subject, resource):
    return _load_readable_profile(subject, resource.user_id)


def _view_achievements(subject, resource):
    return _load_readable_profile(subject, resource.user_id)


def _update_profile(subject, resource):
    del resource
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow()


def _follow(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    target = User.objects.filter(id=resource.following_id).first()
    if target is None:
        return Decision.deny(404, USER_NOT_FOUND)
    if target.id == subject.user_id:
        return Decision.deny(400, CANNOT_FOLLOW_SELF)
    if not UserProfile.objects.filter(
        live_user_filter("user__"),
        user=target,
        is_public=True,
    ).exists():
        return Decision.deny(404, USER_NOT_FOUND)
    return Decision.allow(target)


def _unfollow(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    target = User.objects.filter(id=resource.following_id).first()
    if target is None:
        return Decision.deny(404, USER_NOT_FOUND)
    follow = Follow.objects.filter(
        follower_id=subject.user_id,
        following=target,
    ).first()
    if follow is None:
        return Decision.deny(404, FOLLOW_NOT_FOUND)
    return Decision.allow(follow)


def _view_followers(subject, resource):
    decision = _load_readable_profile(subject, resource.user_id)
    if not decision:
        return decision
    followers = (
        User.objects.filter(following__following=decision.value.user)
        .filter(_visible_users_q(subject))
        .select_related("profile")
        .distinct()
    )
    return Decision.allow(followers)


def _view_following(subject, resource):
    decision = _load_readable_profile(subject, resource.user_id)
    if not decision:
        return decision
    following = (
        User.objects.filter(followers__follower=decision.value.user)
        .filter(_visible_users_q(subject))
        .select_related("profile")
        .distinct()
    )
    return Decision.allow(following)


def _view_friends(subject, resource):
    del resource
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    friends = (
        User.objects.filter(
            followers__follower_id=subject.user_id,
            following__following_id=subject.user_id,
        )
        .filter(_visible_users_q(subject))
        .select_related("profile")
        .distinct()
    )
    return Decision.allow(friends)


def _search_profiles(subject, resource):
    del resource
    users = (
        User.objects.filter(_visible_users_q(subject))
        .select_related("profile")
    )
    return Decision.allow(users)


POLICIES = {
    ("view_profile", UserProfileResource): _view_profile,
    ("view_profile_calendar", UserProfileResource): _view_profile_calendar,
    ("view_achievements", UserProfileResource): _view_achievements,
    ("update_profile", ProfileUpdate): _update_profile,
    ("follow", FollowTarget): _follow,
    ("unfollow", FollowEdge): _unfollow,
    ("view_followers", UserProfileResource): _view_followers,
    ("view_following", UserProfileResource): _view_following,
    ("view_friends", FriendsCollection): _view_friends,
    ("search_profiles", ProfileSearch): _search_profiles,
}
