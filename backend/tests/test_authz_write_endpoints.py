"""쓰기 엔드포인트의 인가를 HTTP 경계에서 고정한다.

## 왜 이 파일이 따로 있는가

특성화 골든(`tests/golden/api_characterization.json`)은 라우트마다 **한 번씩만** 호출하고,
요청 본문은 일반화된 최소 형태다. 그래서 **입력 검증이 인가보다 먼저 걸리는 엔드포인트**에서는
인가 분기에 아예 도달하지 못한다.

실측 예: `POST /api/v1/todos/reading/update/` 의 골든 기록은

    owner 400 · non_owner 400

으로 **두 페르소나가 같다.** 빈 본문이 `_validate_progress_request` 에서 400 으로 걸려
그 뒤의 `can(...)` 판정이 실행되지 않기 때문이다. 실제로 뷰의 인가 분기를 통째로 무력화해도
골든은 통과했다 — 즉 **이 쓰기 경로의 인가는 골든의 보호 밖에 있었다.**

정책 단위 테스트(`tests/test_authz_policy.py`)는 정책 함수를 직접 부르므로 이 구멍을 메우지
못한다. 그건 "정책이 옳게 판정하는가"를 보지, **"뷰가 그 판정을 실제로 따르는가"** 를 보지 않는다.
이 파일이 그 사이를 잇는다.

## 규칙

- **유효한 본문**으로 호출한다. 소유자 케이스가 성공해야 그 본문이 진짜 유효하다는 뜻이고,
  그래야 비소유자의 거부가 "검증 실패"가 아니라 "인가 거부"임이 증명된다.
  소유자 케이스 없이 거부만 단언하면 통과하는 이유를 알 수 없는 공허한 테스트가 된다.
- **현재 동작을 고정할 뿐 바꾸지 않는다.** 상태 코드와 본문은 지금 코드가 내는 값 그대로다.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from todos.models import (
    BibleBookmark,
    BibleHighlight,
    BibleReadingPlan,
    CatchupSchedule,
    CatchupSession,
    DailyBibleSchedule,
    GroupInvitation,
    GroupMembership,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
    PersonalReadingRecord,
    PlanSubscription,
    ReadingGroup,
    ReflectionNote,
    UserReadingPosition,
)

User = get_user_model()

READING_UPDATE_URL = "/api/v1/todos/reading/update/"


def _bearer(user):
    """골든 하네스(`tests/api_characterization.py`)와 같은 방식으로 토큰을 만든다.

    `token_version` 클레임이 없으면 `CookieJWTAuthentication` 이 거부한다.
    """
    token = AccessToken.for_user(user)
    token["token_version"] = user.token_version
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


class ReadingProgressWriteAuthorizationTests(TestCase):
    """`update_progress` 는 남의 구독 진도를 쓸 수 없어야 한다."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="write-authz-owner",
            nickname="쓰기인가소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="write-authz-other",
            nickname="쓰기인가타인",
            password="pw-test-1234",
        )

        self.plan = BibleReadingPlan.objects.create(
            name="쓰기 인가 시험 플랜", created_by=self.owner
        )
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date(2026, 1, 1),
            book="창세기",
            start_chapter=1,
            end_chapter=2,
        )
        # 구독은 owner 에게만 있다. other 는 같은 플랜을 구독하지 않는다.
        PlanSubscription.objects.create(
            user=self.owner, plan=self.plan, start_date=date(2026, 1, 1), is_active=True
        )

        self.payload = {
            "plan_id": self.plan.id,
            "schedule_ids": [self.schedule.id],
            "action": "complete",
        }

    def test_owner_can_write_progress(self):
        """이 본문이 실제로 유효함을 먼저 증명한다 — 아래 거부 단언의 전제다."""
        response = _bearer(self.owner).post(READING_UPDATE_URL, self.payload, format="json")

        self.assertEqual(response.status_code, 200, response.data)

    def test_non_owner_cannot_write_another_users_progress(self):
        """같은 본문을 비소유자가 보내면 거부된다.

        위 테스트가 통과하는 한, 이 404 는 입력 검증이 아니라 인가가 만든 것이다.
        """
        response = _bearer(self.other).post(READING_UPDATE_URL, self.payload, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"], "존재하지 않는 스케줄입니다.")

    def test_non_owner_write_leaves_no_progress_row(self):
        """거부가 응답만 바꾸고 데이터는 이미 쓴 뒤였다면 의미가 없다."""
        from todos.models import UserBibleProgress

        _bearer(self.other).post(READING_UPDATE_URL, self.payload, format="json")

        # 진도는 구독을 통해 사용자에게 매달린다. 남의 구독에도, 자기 것에도 생기면 안 된다.
        self.assertFalse(
            UserBibleProgress.objects.filter(schedule=self.schedule).exists()
        )

    def test_anonymous_cannot_write_progress(self):
        response = APIClient().post(READING_UPDATE_URL, self.payload, format="json")

        self.assertEqual(response.status_code, 401)


class _ArtifactUsers:
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(
            username="artifact-write-owner",
            nickname="아티팩트쓰기소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="artifact-write-other",
            nickname="아티팩트쓰기타인",
            password="pw-test-1234",
        )


class BibleBookmarkWriteAuthorizationTests(_ArtifactUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.owner_bookmark = BibleBookmark.objects.create(
            user=self.owner,
            bookmark_type="chapter",
            book="gen",
            chapter=1,
            title="소유자",
        )
        self.other_bookmark = BibleBookmark.objects.create(
            user=self.other,
            bookmark_type="chapter",
            book="exo",
            chapter=1,
            title="타인",
        )
        self.create_payload = {
            "bookmark_type": "chapter",
            "book": "lev",
            "chapter": 1,
            "title": "새 북마크",
        }

    def test_owner_can_create_and_update_own_bookmark(self):
        created = _bearer(self.owner).post(
            "/api/v1/todos/bible/bookmarks/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["book"], "lev")

        updated = _bearer(self.owner).patch(
            f"/api/v1/todos/bible/bookmarks/{self.owner_bookmark.id}/",
            {"title": "수정됨"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.owner_bookmark.refresh_from_db()
        self.assertEqual(self.owner_bookmark.title, "수정됨")

    def test_owner_can_delete_own_bookmark(self):
        response = _bearer(self.owner).delete(
            f"/api/v1/todos/bible/bookmarks/{self.owner_bookmark.id}/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            BibleBookmark.objects.filter(pk=self.owner_bookmark.id).exists()
        )

    def test_non_owner_cannot_update_or_delete_another_users_bookmark(self):
        patched = _bearer(self.other).patch(
            f"/api/v1/todos/bible/bookmarks/{self.owner_bookmark.id}/",
            {"title": "탈취"},
            format="json",
        )
        self.assertEqual(patched.status_code, 404)
        self.owner_bookmark.refresh_from_db()
        self.assertEqual(self.owner_bookmark.title, "소유자")

        deleted = _bearer(self.other).delete(
            f"/api/v1/todos/bible/bookmarks/{self.owner_bookmark.id}/"
        )
        self.assertEqual(deleted.status_code, 404)
        self.assertTrue(
            BibleBookmark.objects.filter(pk=self.owner_bookmark.id).exists()
        )

    def test_delete_all_does_not_remove_another_users_bookmarks(self):
        response = _bearer(self.other).delete(
            "/api/v1/todos/bible/bookmarks/delete-all/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            BibleBookmark.objects.filter(pk=self.owner_bookmark.id).exists()
        )
        self.assertFalse(
            BibleBookmark.objects.filter(pk=self.other_bookmark.id).exists()
        )

    def test_anonymous_cannot_create_bookmark(self):
        response = APIClient().post(
            "/api/v1/todos/bible/bookmarks/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(BibleBookmark.objects.filter(book="lev").exists())


class BibleHighlightWriteAuthorizationTests(_ArtifactUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.owner_highlight = BibleHighlight.objects.create(
            user=self.owner,
            book="gen",
            chapter=1,
            start_verse=1,
            end_verse=2,
            memo="소유자",
        )
        self.create_payload = {
            "book": "lev",
            "chapter": 1,
            "start_verse": 1,
            "end_verse": 3,
            "memo": "새 하이라이트",
        }

    def test_owner_can_create_and_update_own_highlight(self):
        created = _bearer(self.owner).post(
            "/api/v1/todos/bible/highlights/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)

        updated = _bearer(self.owner).patch(
            f"/api/v1/todos/bible/highlights/{self.owner_highlight.id}/",
            {"memo": "수정됨"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.owner_highlight.refresh_from_db()
        self.assertEqual(self.owner_highlight.memo, "수정됨")

    def test_non_owner_cannot_update_or_delete_another_users_highlight(self):
        patched = _bearer(self.other).patch(
            f"/api/v1/todos/bible/highlights/{self.owner_highlight.id}/",
            {"memo": "탈취"},
            format="json",
        )
        self.assertEqual(patched.status_code, 404)
        self.owner_highlight.refresh_from_db()
        self.assertEqual(self.owner_highlight.memo, "소유자")

        deleted = _bearer(self.other).delete(
            f"/api/v1/todos/bible/highlights/{self.owner_highlight.id}/"
        )
        self.assertEqual(deleted.status_code, 404)
        self.assertTrue(
            BibleHighlight.objects.filter(pk=self.owner_highlight.id).exists()
        )

    def test_delete_all_does_not_remove_another_users_highlights(self):
        BibleHighlight.objects.create(
            user=self.other, book="exo", chapter=1, start_verse=1, end_verse=1
        )
        response = _bearer(self.other).delete(
            "/api/v1/todos/bible/highlights/delete-all/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            BibleHighlight.objects.filter(pk=self.owner_highlight.id).exists()
        )
        self.assertFalse(BibleHighlight.objects.filter(user=self.other).exists())


class ReflectionNoteWriteAuthorizationTests(_ArtifactUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.owner_note = ReflectionNote.objects.create(
            user=self.owner, book="gen", chapter=1, content="소유자 노트"
        )
        self.create_payload = {"book": "lev", "chapter": 1, "content": "새 노트"}

    def test_owner_can_create_and_update_own_note(self):
        created = _bearer(self.owner).post(
            "/api/v1/todos/bible/notes/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)

        updated = _bearer(self.owner).patch(
            f"/api/v1/todos/bible/notes/{self.owner_note.id}/",
            {"content": "수정됨"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.owner_note.refresh_from_db()
        self.assertEqual(self.owner_note.content, "수정됨")

    def test_non_owner_cannot_update_or_delete_another_users_note(self):
        patched = _bearer(self.other).patch(
            f"/api/v1/todos/bible/notes/{self.owner_note.id}/",
            {"content": "탈취"},
            format="json",
        )
        self.assertEqual(patched.status_code, 404)
        self.owner_note.refresh_from_db()
        self.assertEqual(self.owner_note.content, "소유자 노트")

        deleted = _bearer(self.other).delete(
            f"/api/v1/todos/bible/notes/{self.owner_note.id}/"
        )
        self.assertEqual(deleted.status_code, 404)
        self.assertTrue(ReflectionNote.objects.filter(pk=self.owner_note.id).exists())

    def test_delete_all_does_not_remove_another_users_notes(self):
        ReflectionNote.objects.create(
            user=self.other, book="exo", chapter=1, content="타인"
        )
        response = _bearer(self.other).delete(
            "/api/v1/todos/bible/notes/delete-all/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(ReflectionNote.objects.filter(pk=self.owner_note.id).exists())
        self.assertFalse(ReflectionNote.objects.filter(user=self.other).exists())


class ReadingPositionWriteAuthorizationTests(_ArtifactUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.owner_position = UserReadingPosition.objects.create(
            user=self.owner, book="gen", chapter=1, verse=1, version="GAE"
        )
        self.payload = {
            "book": "exo",
            "chapter": 2,
            "verse": 3,
            "scroll_position": 0.25,
            "version": "GAE",
        }

    def test_owner_can_save_own_reading_position(self):
        response = _bearer(self.owner).post(
            "/api/v1/todos/bible/reading-position/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner_position.refresh_from_db()
        self.assertEqual(self.owner_position.book, "exo")
        self.assertEqual(self.owner_position.chapter, 2)

    def test_other_user_save_does_not_overwrite_owner_position(self):
        response = _bearer(self.other).post(
            "/api/v1/todos/bible/reading-position/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner_position.refresh_from_db()
        self.assertEqual(self.owner_position.book, "gen")
        self.assertEqual(
            UserReadingPosition.objects.get(user=self.other).book, "exo"
        )

    def test_anonymous_cannot_save_reading_position(self):
        response = APIClient().post(
            "/api/v1/todos/bible/reading-position/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(UserReadingPosition.objects.count(), 1)


class PersonalRecordWriteAuthorizationTests(_ArtifactUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.payload = {"book": "gen", "chapter": 1, "read_date": "2026-01-01"}

    def test_owner_can_record_own_reading(self):
        response = _bearer(self.owner).post(
            "/api/v1/todos/bible/personal-records/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            PersonalReadingRecord.objects.filter(
                user=self.owner, book="gen", chapter=1
            ).exists()
        )

    def test_other_user_record_is_not_attached_to_owner(self):
        response = _bearer(self.other).post(
            "/api/v1/todos/bible/personal-records/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(
            PersonalReadingRecord.objects.filter(user=self.owner).exists()
        )
        self.assertTrue(
            PersonalReadingRecord.objects.filter(
                user=self.other, book="gen", chapter=1
            ).exists()
        )

    def test_anonymous_cannot_record_reading(self):
        response = APIClient().post(
            "/api/v1/todos/bible/personal-records/",
            self.payload,
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(PersonalReadingRecord.objects.exists())


class _GroupWriteUsers:
    def setUp(self):
        super().setUp()
        self.creator = User.objects.create_user(
            username="group-write-creator",
            nickname="그룹쓰기생성자",
            password="pw-test-1234",
        )
        self.admin = User.objects.create_user(
            username="group-write-admin",
            nickname="그룹쓰기관리자",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="group-write-member",
            nickname="그룹쓰기멤버",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="group-write-outsider",
            nickname="그룹쓰기외부",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="그룹 쓰기 인가 플랜",
            created_by=self.creator,
            is_active=True,
        )
        self.public_group = ReadingGroup.objects.create(
            name="공개쓰기그룹",
            creator=self.creator,
            is_public=True,
            max_members=50,
        )
        self.private_group = ReadingGroup.objects.create(
            name="비공개쓰기그룹",
            creator=self.creator,
            is_public=False,
            max_members=50,
        )
        self.public_group.plans.add(self.plan)
        self.private_group.plans.add(self.plan)
        for group in (self.public_group, self.private_group):
            GroupMembership.objects.create(
                group=group, user=self.creator, role="admin", is_active=True
            )
            GroupMembership.objects.create(
                group=group, user=self.admin, role="admin", is_active=True
            )
            GroupMembership.objects.create(
                group=group, user=self.member, role="member", is_active=True
            )


class CreateGroupWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def test_authenticated_user_can_create_group(self):
        response = _bearer(self.member).post(
            "/api/v1/todos/groups/create/",
            {
                "name": "새 쓰기그룹",
                "plan_ids": [self.plan.id],
                "is_public": True,
                "max_members": 20,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(ReadingGroup.objects.filter(name="새 쓰기그룹").exists())

    def test_anonymous_create_leaves_no_group(self):
        response = APIClient().post(
            "/api/v1/todos/groups/create/",
            {
                "name": "익명그룹",
                "plan_ids": [self.plan.id],
                "is_public": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(ReadingGroup.objects.filter(name="익명그룹").exists())


class JoinGroupWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def test_outsider_can_join_public_group(self):
        response = _bearer(self.outsider).post(
            f"/api/v1/todos/groups/{self.public_group.id}/join/"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            GroupMembership.objects.filter(
                group=self.public_group,
                user=self.outsider,
                is_active=True,
            ).exists()
        )

    def test_outsider_cannot_join_private_group_without_invite(self):
        response = _bearer(self.outsider).post(
            f"/api/v1/todos/groups/{self.private_group.id}/join/"
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group, user=self.outsider
            ).exists()
        )

    def test_member_join_does_not_create_another_membership(self):
        before = GroupMembership.objects.filter(group=self.public_group).count()
        response = _bearer(self.member).post(
            f"/api/v1/todos/groups/{self.public_group.id}/join/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            GroupMembership.objects.filter(group=self.public_group).count(),
            before,
        )


class LeaveGroupWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def test_member_can_leave_group(self):
        response = _bearer(self.member).post(
            f"/api/v1/todos/groups/{self.public_group.id}/leave/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        membership = GroupMembership.objects.get(
            group=self.public_group, user=self.member
        )
        self.assertFalse(membership.is_active)

    def test_creator_leave_does_not_deactivate_membership(self):
        response = _bearer(self.creator).post(
            f"/api/v1/todos/groups/{self.public_group.id}/leave/"
        )
        self.assertEqual(response.status_code, 400)
        membership = GroupMembership.objects.get(
            group=self.public_group, user=self.creator
        )
        self.assertTrue(membership.is_active)

    def test_outsider_leave_does_not_touch_member_rows(self):
        response = _bearer(self.outsider).post(
            f"/api/v1/todos/groups/{self.public_group.id}/leave/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(
            GroupMembership.objects.filter(
                group=self.public_group, user=self.member, is_active=True
            ).exists()
        )


class InviteToGroupWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def test_admin_can_invite_outsider(self):
        response = _bearer(self.admin).post(
            f"/api/v1/todos/groups/{self.public_group.id}/invite/",
            {"user_id": self.outsider.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            GroupInvitation.objects.filter(
                group=self.public_group,
                invitee=self.outsider,
                status="pending",
            ).exists()
        )

    def test_member_invite_creates_no_invitation(self):
        response = _bearer(self.member).post(
            f"/api/v1/todos/groups/{self.public_group.id}/invite/",
            {"user_id": self.outsider.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            GroupInvitation.objects.filter(
                group=self.public_group, invitee=self.outsider
            ).exists()
        )

    def test_outsider_invite_to_private_group_is_hidden(self):
        response = _bearer(self.outsider).post(
            f"/api/v1/todos/groups/{self.private_group.id}/invite/",
            {"user_id": self.member.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(
            GroupInvitation.objects.filter(group=self.private_group).exists()
        )


class GroupVisibilityWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def test_member_can_update_own_profile_visibility(self):
        membership = GroupMembership.objects.get(
            group=self.public_group, user=self.member
        )
        self.assertTrue(membership.show_in_profile)
        response = _bearer(self.member).patch(
            f"/api/v1/todos/groups/{self.public_group.id}/visibility/",
            {"show_in_profile": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        membership.refresh_from_db()
        self.assertFalse(membership.show_in_profile)

    def test_outsider_visibility_update_does_not_change_member_row(self):
        membership = GroupMembership.objects.get(
            group=self.public_group, user=self.member
        )
        response = _bearer(self.outsider).patch(
            f"/api/v1/todos/groups/{self.public_group.id}/visibility/",
            {"show_in_profile": False},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        membership.refresh_from_db()
        self.assertTrue(membership.show_in_profile)


class RespondInvitationWriteAuthorizationTests(_GroupWriteUsers, TestCase):
    def setUp(self):
        super().setUp()
        self.invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.creator,
            invitee=self.outsider,
            status="pending",
        )

    def test_invitee_can_decline_invitation(self):
        response = _bearer(self.outsider).post(
            f"/api/v1/todos/invitations/{self.invitation.id}/respond/",
            {"action": "decline"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, "declined")

    def test_non_invitee_response_leaves_invitation_pending(self):
        response = _bearer(self.member).post(
            f"/api/v1/todos/invitations/{self.invitation.id}/respond/",
            {"action": "decline"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, "pending")
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group, user=self.outsider
            ).exists()
        )



class CatchupWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="catchup-write-owner",
            nickname="캐치업쓰기소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="catchup-write-other",
            nickname="캐치업쓰기타인",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="캐치업 쓰기 플랜", created_by=self.owner
        )
        overdue_date = date.today() - timedelta(days=2)
        self.subscription = PlanSubscription.objects.create(
            user=self.owner,
            plan=self.plan,
            start_date=overdue_date,
            is_active=True,
        )
        self.original = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=overdue_date,
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        self.session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="쓰기 따라잡기",
            range_start=overdue_date,
            range_end=overdue_date,
            max_daily_readings=1,
        )
        self.catchup_schedule = CatchupSchedule.objects.create(
            session=self.session,
            original_schedule=self.original,
            scheduled_date=date.today(),
        )
        create_plan = BibleReadingPlan.objects.create(
            name="캐치업 생성 플랜", created_by=self.owner
        )
        self.create_subscription = PlanSubscription.objects.create(
            user=self.owner,
            plan=create_plan,
            start_date=overdue_date,
            is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=create_plan,
            date=overdue_date,
            book="출애굽기",
            start_chapter=1,
            end_chapter=1,
        )
        self.create_payload = {
            "name": "새 따라잡기",
            "range_start": overdue_date.isoformat(),
            "range_end": overdue_date.isoformat(),
            "max_daily_readings": 1,
            "max_daily_chapters": 1,
        }

    def test_owner_can_preview_and_create_catchup(self):
        preview = _bearer(self.owner).post(
            f"/api/v1/todos/subscriptions/{self.create_subscription.id}/catchup/preview/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertTrue(preview.data["valid"])

        created = _bearer(self.owner).post(
            f"/api/v1/todos/subscriptions/{self.create_subscription.id}/catchup/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(
            CatchupSession.objects.filter(
                subscription=self.create_subscription, name="새 따라잡기"
            ).exists()
        )

    def test_non_owner_cannot_preview_or_create_another_users_catchup(self):
        preview = _bearer(self.other).post(
            f"/api/v1/todos/subscriptions/{self.create_subscription.id}/catchup/preview/",
            self.create_payload,
            format="json",
        )
        created = _bearer(self.other).post(
            f"/api/v1/todos/subscriptions/{self.create_subscription.id}/catchup/",
            self.create_payload,
            format="json",
        )

        self.assertEqual(preview.status_code, 404)
        self.assertEqual(created.status_code, 404)
        self.assertFalse(
            CatchupSession.objects.filter(
                subscription=self.create_subscription
            ).exists()
        )

    def test_owner_can_update_toggle_and_complete_own_session(self):
        updated = _bearer(self.owner).patch(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/update/",
            {"name": "수정된 따라잡기"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "수정된 따라잡기")

        toggled = _bearer(self.owner).post(
            f"/api/v1/todos/catchup-schedules/{self.catchup_schedule.id}/toggle/"
        )
        self.assertEqual(toggled.status_code, 200, toggled.data)
        self.catchup_schedule.refresh_from_db()
        self.assertTrue(self.catchup_schedule.is_completed)

        completed = _bearer(self.owner).post(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/complete/"
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "completed")

    def test_non_owner_writes_do_not_change_catchup_state(self):
        patched = _bearer(self.other).patch(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/update/",
            {"name": "탈취"},
            format="json",
        )
        toggled = _bearer(self.other).post(
            f"/api/v1/todos/catchup-schedules/{self.catchup_schedule.id}/toggle/"
        )
        completed = _bearer(self.other).post(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/complete/"
        )
        abandoned = _bearer(self.other).post(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/abandon/"
        )

        self.assertEqual(patched.status_code, 404)
        self.assertEqual(toggled.status_code, 404)
        self.assertEqual(completed.status_code, 404)
        self.assertEqual(abandoned.status_code, 404)
        self.session.refresh_from_db()
        self.catchup_schedule.refresh_from_db()
        self.assertEqual(self.session.name, "쓰기 따라잡기")
        self.assertEqual(self.session.status, "active")
        self.assertFalse(self.catchup_schedule.is_completed)

    def test_owner_can_abandon_own_session(self):
        response = _bearer(self.owner).post(
            f"/api/v1/todos/catchup-sessions/{self.session.id}/abandon/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "abandoned")

    def test_anonymous_cannot_write_catchup(self):
        response = APIClient().post(
            f"/api/v1/todos/subscriptions/{self.create_subscription.id}/catchup/",
            self.create_payload,
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(
            CatchupSession.objects.filter(
                subscription=self.create_subscription
            ).exists()
        )


class NotificationWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="notif-write-owner",
            nickname="알림쓰기소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="notif-write-other",
            nickname="알림쓰기타인",
            password="pw-test-1234",
        )
        self.owner_notification = Notification.objects.create(
            recipient=self.owner,
            type="system",
            title="소유자 알림",
            body="읽지 않음",
        )
        self.other_notification = Notification.objects.create(
            recipient=self.other,
            type="system",
            title="타인 알림",
            body="읽지 않음",
        )
        self.owner_settings = NotificationSettings.objects.create(user=self.owner)
        self.other_settings = NotificationSettings.objects.create(user=self.other)
        self.push_payload = {
            "endpoint": (
                "https://updates.push.services.mozilla.com/wpush/v2/write-authz"
            ),
            "keys": {"p256dh": "public-key", "auth": "auth-secret"},
        }

    def test_owner_can_mark_own_notification_read(self):
        response = _bearer(self.owner).patch(
            f"/api/v1/todos/notifications/{self.owner_notification.id}/read/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner_notification.refresh_from_db()
        self.assertIsNotNone(self.owner_notification.read_at)

    def test_non_owner_cannot_mark_another_users_notification_read(self):
        response = _bearer(self.other).patch(
            f"/api/v1/todos/notifications/{self.owner_notification.id}/read/"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "알림을 찾을 수 없습니다.")
        self.owner_notification.refresh_from_db()
        self.assertIsNone(self.owner_notification.read_at)

    def test_mark_all_read_does_not_touch_another_users_inbox(self):
        response = _bearer(self.other).post(
            "/api/v1/todos/notifications/mark-all-read/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["updated_count"], 1)
        self.owner_notification.refresh_from_db()
        self.other_notification.refresh_from_db()
        self.assertIsNone(self.owner_notification.read_at)
        self.assertIsNotNone(self.other_notification.read_at)

    def test_settings_update_is_self_scoped(self):
        owner = _bearer(self.owner).patch(
            "/api/v1/todos/notifications/settings/",
            {"notifications_enabled": False},
            format="json",
        )
        other = _bearer(self.other).patch(
            "/api/v1/todos/notifications/settings/",
            {"friend_activity_enabled": False},
            format="json",
        )
        self.assertEqual(owner.status_code, 200, owner.data)
        self.assertEqual(other.status_code, 200, other.data)
        self.owner_settings.refresh_from_db()
        self.other_settings.refresh_from_db()
        self.assertFalse(self.owner_settings.notifications_enabled)
        self.assertTrue(self.other_settings.notifications_enabled)
        self.assertFalse(self.other_settings.friend_activity_enabled)
        self.assertTrue(self.owner_settings.friend_activity_enabled)

    def test_push_register_and_remove_preserve_device_ownership(self):
        created = _bearer(self.owner).post(
            "/api/v1/todos/notifications/push/subscriptions/",
            self.push_payload,
            format="json",
        )
        self.assertEqual(created.status_code, 200, created.data)

        conflict = _bearer(self.other).post(
            "/api/v1/todos/notifications/push/subscriptions/",
            self.push_payload,
            format="json",
        )
        self.assertEqual(conflict.status_code, 409)
        subscription = NotificationPushSubscription.objects.get(
            endpoint=self.push_payload["endpoint"]
        )
        self.assertEqual(subscription.user_id, self.owner.id)
        self.assertTrue(subscription.enabled)

        other_remove = _bearer(self.other).post(
            "/api/v1/todos/notifications/push/subscriptions/remove/",
            {"endpoint": self.push_payload["endpoint"]},
            format="json",
        )
        self.assertEqual(other_remove.status_code, 200, other_remove.data)
        self.assertEqual(other_remove.data["updated_count"], 0)
        subscription.refresh_from_db()
        self.assertTrue(subscription.enabled)

        owner_remove = _bearer(self.owner).post(
            "/api/v1/todos/notifications/push/subscriptions/remove/",
            {"endpoint": self.push_payload["endpoint"]},
            format="json",
        )
        self.assertEqual(owner_remove.status_code, 200, owner_remove.data)
        self.assertEqual(owner_remove.data["updated_count"], 1)
        subscription.refresh_from_db()
        self.assertFalse(subscription.enabled)

    def test_anonymous_cannot_mark_notification_read(self):
        response = APIClient().patch(
            f"/api/v1/todos/notifications/{self.owner_notification.id}/read/"
        )
        self.assertEqual(response.status_code, 401)
        self.owner_notification.refresh_from_db()
        self.assertIsNone(self.owner_notification.read_at)
