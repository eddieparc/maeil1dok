from datetime import date
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from authz import SubjectKind, can, subject_from_request
from authz.policies.plan_subscription import (
    PlanSubscriptionCollection,
    PlanSubscriptionCreation,
    PlanSubscriptionResource,
)
from authz.policies.bible_bookmark import (
    BibleBookmarkCollection,
    BibleBookmarkCreation,
    BibleBookmarkResource,
)
from authz.policies.bible_highlight import (
    BibleHighlightCollection,
    BibleHighlightCreation,
    BibleHighlightResource,
)
from authz.policies.bible_note import (
    ReflectionNoteCollection,
    ReflectionNoteCreation,
    ReflectionNoteResource,
)
from authz.policies.bible_personal_record import (
    PersonalReadingRecordCollection,
    PersonalReadingRecordCreation,
)
from authz.policies.bible_reading_position import ReadingPositionCurrent
from authz.policies.reading_group import (
    GroupInvitationCollection,
    GroupInvitationResource,
    GroupScoreboardResource,
    MembershipProfileVisibility,
    ProfileGroupsQuery,
    ReadingGroupCollection,
    ReadingGroupCreation,
    ReadingGroupMembershipResource,
    ReadingGroupResource,
)
from authz.policies.reading_progress import (
    CertificationProgress,
    ReadingProgressUpdate,
)
from todos.models import (
    BibleBookmark,
    BibleHighlight,
    BibleReadingPlan,
    DailyBibleSchedule,
    GroupInvitation,
    GroupMembership,
    PersonalReadingRecord,
    PlanSubscription,
    ReadingGroup,
    ReflectionNote,
    UserReadingPosition,
)


User = get_user_model()


class AuthzPolicyTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="policy-owner",
            nickname="정책소유자",
            password="pw-test-1234",
        )
        self.non_owner = User.objects.create_user(
            username="policy-non-owner",
            nickname="정책비소유자",
            password="pw-test-1234",
        )
        self.staff = User.objects.create_user(
            username="policy-staff",
            nickname="정책스태프",
            password="pw-test-1234",
            is_staff=True,
        )
        self.owner_plan = self._plan(self.owner, "Owner plan")
        self.non_owner_plan = self._plan(self.non_owner, "Non-owner plan")
        self.staff_plan = self._plan(self.staff, "Staff plan")
        self.owner_subscription = self._subscription(self.owner, self.owner_plan)
        self.non_owner_subscription = self._subscription(
            self.non_owner,
            self.non_owner_plan,
        )
        self.staff_subscription = self._subscription(self.staff, self.staff_plan)
        self.owner_schedule = self._schedule(self.owner_plan, "창세기")
        self.non_owner_schedule = self._schedule(self.non_owner_plan, "출애굽기")
        self.staff_schedule = self._schedule(self.staff_plan, "레위기")

        self.anonymous_subject = self._subject(AnonymousUser())
        self.owner_subject = self._subject(self.owner)
        self.non_owner_subject = self._subject(self.non_owner)
        self.staff_subject = self._subject(self.staff)

    def _plan(self, owner, name):
        return BibleReadingPlan.objects.create(name=name, created_by=owner)

    def _subscription(self, user, plan):
        return PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )

    def _schedule(self, plan, book):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=date(2026, 1, 1),
            book=book,
            start_chapter=1,
            end_chapter=2,
        )

    def _subject(self, user):
        return subject_from_request(SimpleNamespace(user=user))

    def test_subject_from_request_records_anonymous_user_staff_and_system(self):
        self.assertEqual(self.anonymous_subject.kind, SubjectKind.ANONYMOUS)
        self.assertEqual(self.owner_subject.user_id, self.owner.id)
        self.assertFalse(self.owner_subject.is_staff)
        self.assertTrue(self.staff_subject.is_staff)

        system_subject = subject_from_request(
            SimpleNamespace(user=AnonymousUser()),
            system="cron",
        )
        self.assertEqual(system_subject.kind, SubjectKind.SYSTEM)
        self.assertEqual(system_subject.system, "cron")

    def test_subscription_owner_can_view(self):
        decision = can(
            self.owner_subject,
            "view_subscription",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertTrue(decision)
        self.assertEqual(decision.value, self.owner_subscription)

    def test_subscription_non_owner_is_denied_with_hidden_not_found(self):
        decision = can(
            self.non_owner_subject,
            "view_subscription",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

    def test_subscription_anonymous_subject_is_denied(self):
        decision = can(
            self.anonymous_subject,
            "view_subscription",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

    def test_subscription_staff_has_no_non_owner_bypass(self):
        decision = can(
            self.staff_subject,
            "view_subscription",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

    def test_subscription_staff_can_view_own_subscription(self):
        decision = can(
            self.staff_subject,
            "view_subscription",
            PlanSubscriptionResource(self.staff_subscription.id),
        )

        self.assertTrue(decision)

    def test_subscription_collection_relations_are_scoped_in_policy(self):
        owner_decision = can(
            self.owner_subject,
            "view_subscriptions",
            PlanSubscriptionCollection(),
        )
        anonymous_decision = can(
            self.anonymous_subject,
            "view_subscriptions",
            PlanSubscriptionCollection(),
        )

        self.assertTrue(owner_decision)
        self.assertEqual(list(owner_decision.value.items), [self.owner_subscription])
        self.assertTrue(anonymous_decision)
        self.assertEqual(len(list(anonymous_decision.value.items)), 3)

    def test_subscribe_requires_authenticated_matching_owner(self):
        owner_decision = can(
            self.owner_subject,
            "subscribe",
            PlanSubscriptionCreation(owner_id=self.owner.id),
        )
        non_owner_decision = can(
            self.non_owner_subject,
            "subscribe",
            PlanSubscriptionCreation(owner_id=self.owner.id),
        )
        anonymous_decision = can(
            self.anonymous_subject,
            "subscribe",
            PlanSubscriptionCreation(owner_id=None),
        )

        self.assertTrue(owner_decision)
        self.assertFalse(non_owner_decision)
        self.assertFalse(anonymous_decision)
        self.assertEqual(anonymous_decision.denial.status_code, 401)

    def test_unsubscribe_preserves_default_subscription_denial(self):
        self.owner_plan.is_default = True
        self.owner_plan.save(update_fields=["is_default"])

        decision = can(
            self.owner_subject,
            "unsubscribe",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 400)
        self.assertEqual(
            decision.denial.body,
            {"detail": "기본 플랜 구독은 삭제할 수 없습니다."},
        )

    def test_toggle_preserves_inactive_plan_reactivation_denial(self):
        self.owner_subscription.is_active = False
        self.owner_subscription.save(update_fields=["is_active"])
        self.owner_plan.is_active = False
        self.owner_plan.save(update_fields=["is_active"])

        decision = can(
            self.owner_subject,
            "toggle_active",
            PlanSubscriptionResource(self.owner_subscription.id),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 400)
        self.assertIn("중단된 플랜", decision.denial.body["detail"])

    def test_progress_owner_can_update(self):
        decision = can(
            self.owner_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.owner_schedule.id,),
            ),
        )

        self.assertTrue(decision)
        self.assertEqual(decision.value.subscription, self.owner_subscription)
        self.assertEqual(decision.value.schedules, (self.owner_schedule,))

    def test_progress_non_owner_is_denied(self):
        decision = can(
            self.non_owner_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.owner_schedule.id,),
            ),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

    def test_progress_anonymous_subject_is_denied(self):
        decision = can(
            self.anonymous_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.owner_schedule.id,),
            ),
        )

        self.assertFalse(decision)

    def test_progress_staff_has_no_non_owner_subscription_bypass(self):
        decision = can(
            self.staff_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.owner_schedule.id,),
            ),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

    def test_progress_staff_can_update_own_subscription(self):
        decision = can(
            self.staff_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.staff_plan.id,
                schedule_ids=(self.staff_schedule.id,),
            ),
        )

        self.assertTrue(decision)
        self.assertEqual(decision.value.subscription, self.staff_subscription)

    def test_progress_plan_schedule_mismatch_preserves_bad_request(self):
        decision = can(
            self.owner_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.non_owner_schedule.id,),
            ),
        )

        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 404)

        self._subscription(self.owner, self.non_owner_plan)
        decision = can(
            self.owner_subject,
            "update_progress",
            ReadingProgressUpdate(
                plan_id=self.owner_plan.id,
                schedule_ids=(self.non_owner_schedule.id,),
            ),
        )
        self.assertFalse(decision)
        self.assertEqual(decision.denial.status_code, 400)

    def test_certification_progress_owner_can_view(self):
        decision = can(
            self.owner_subject,
            "view_certification_progress",
            CertificationProgress(
                plan_id=self.owner_plan.id,
                schedule_id=self.owner_schedule.id,
            ),
        )

        self.assertTrue(decision)
        self.assertEqual(decision.value.subscription, self.owner_subscription)
        self.assertEqual(decision.value.selected_schedule, self.owner_schedule)

    def test_certification_progress_denies_non_owner_anonymous_and_staff(self):
        resource = CertificationProgress(plan_id=self.owner_plan.id)

        for subject in (
            self.non_owner_subject,
            self.anonymous_subject,
            self.staff_subject,
        ):
            with self.subTest(subject=subject.kind, user_id=subject.user_id):
                decision = can(
                    subject,
                    "view_certification_progress",
                    resource,
                )
                self.assertFalse(decision)
                self.assertEqual(decision.denial.status_code, 404)


class BibleArtifactAuthzPolicyTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="artifact-owner",
            nickname="아티팩트소유자",
            password="pw-test-1234",
        )
        self.non_owner = User.objects.create_user(
            username="artifact-non-owner",
            nickname="아티팩트비소유자",
            password="pw-test-1234",
        )
        self.staff = User.objects.create_user(
            username="artifact-staff",
            nickname="아티팩트스태프",
            password="pw-test-1234",
            is_staff=True,
        )
        self.anonymous_subject = subject_from_request(
            SimpleNamespace(user=AnonymousUser())
        )
        self.owner_subject = subject_from_request(SimpleNamespace(user=self.owner))
        self.non_owner_subject = subject_from_request(
            SimpleNamespace(user=self.non_owner)
        )
        self.staff_subject = subject_from_request(SimpleNamespace(user=self.staff))

        self.owner_bookmark = BibleBookmark.objects.create(
            user=self.owner, bookmark_type="chapter", book="gen", chapter=1
        )
        self.staff_bookmark = BibleBookmark.objects.create(
            user=self.staff, bookmark_type="chapter", book="exo", chapter=1
        )
        self.owner_highlight = BibleHighlight.objects.create(
            user=self.owner, book="gen", chapter=1, start_verse=1, end_verse=2
        )
        self.staff_highlight = BibleHighlight.objects.create(
            user=self.staff, book="exo", chapter=1, start_verse=1, end_verse=2
        )
        self.owner_note = ReflectionNote.objects.create(
            user=self.owner, book="gen", chapter=1, content="소유자 노트"
        )
        self.staff_note = ReflectionNote.objects.create(
            user=self.staff, book="exo", chapter=1, content="스태프 노트"
        )
        self.owner_position = UserReadingPosition.objects.create(
            user=self.owner, book="gen", chapter=1, verse=1
        )
        self.staff_position = UserReadingPosition.objects.create(
            user=self.staff, book="exo", chapter=1, verse=1
        )
        self.owner_record = PersonalReadingRecord.objects.create(
            user=self.owner, book="gen", chapter=1, read_date=date(2026, 1, 1)
        )
        self.staff_record = PersonalReadingRecord.objects.create(
            user=self.staff, book="exo", chapter=1, read_date=date(2026, 1, 1)
        )

    def test_bookmark_owner_can_view_and_non_owners_are_hidden(self):
        owner = can(
            self.owner_subject,
            "view_bookmark",
            BibleBookmarkResource(self.owner_bookmark.id),
        )
        self.assertTrue(owner)
        self.assertEqual(owner.value, self.owner_bookmark)

        for subject in (
            self.non_owner_subject,
            self.anonymous_subject,
            self.staff_subject,
        ):
            with self.subTest(user_id=subject.user_id):
                decision = can(
                    subject,
                    "view_bookmark",
                    BibleBookmarkResource(self.owner_bookmark.id),
                )
                self.assertFalse(decision)
                self.assertEqual(decision.denial.status_code, 404)

        staff_own = can(
            self.staff_subject,
            "update_bookmark",
            BibleBookmarkResource(self.staff_bookmark.id),
        )
        self.assertTrue(staff_own)

    def test_bookmark_collection_and_create_are_owner_scoped(self):
        owner = can(
            self.owner_subject, "list_bookmarks", BibleBookmarkCollection()
        )
        self.assertTrue(owner)
        self.assertEqual(list(owner.value), [self.owner_bookmark])

        anonymous = can(
            self.anonymous_subject, "clear_bookmarks", BibleBookmarkCollection()
        )
        self.assertFalse(anonymous)
        self.assertEqual(anonymous.denial.status_code, 401)

        create_own = can(
            self.owner_subject,
            "create_bookmark",
            BibleBookmarkCreation(owner_id=self.owner.id),
        )
        create_other = can(
            self.non_owner_subject,
            "create_bookmark",
            BibleBookmarkCreation(owner_id=self.owner.id),
        )
        self.assertTrue(create_own)
        self.assertFalse(create_other)
        self.assertEqual(create_other.denial.status_code, 404)

    def test_highlight_owner_can_view_and_non_owners_are_hidden(self):
        owner = can(
            self.owner_subject,
            "delete_highlight",
            BibleHighlightResource(self.owner_highlight.id),
        )
        self.assertTrue(owner)
        self.assertEqual(owner.value, self.owner_highlight)

        for subject in (
            self.non_owner_subject,
            self.anonymous_subject,
            self.staff_subject,
        ):
            with self.subTest(user_id=subject.user_id):
                decision = can(
                    subject,
                    "view_highlight",
                    BibleHighlightResource(self.owner_highlight.id),
                )
                self.assertFalse(decision)
                self.assertEqual(decision.denial.status_code, 404)

        staff_own = can(
            self.staff_subject,
            "list_highlights",
            BibleHighlightCollection(),
        )
        self.assertTrue(staff_own)
        self.assertEqual(list(staff_own.value), [self.staff_highlight])

        create_other = can(
            self.non_owner_subject,
            "create_highlight",
            BibleHighlightCreation(owner_id=self.owner.id),
        )
        self.assertFalse(create_other)

    def test_note_owner_can_view_and_non_owners_are_hidden(self):
        owner = can(
            self.owner_subject,
            "view_note",
            ReflectionNoteResource(self.owner_note.id),
        )
        self.assertTrue(owner)
        self.assertEqual(owner.value, self.owner_note)

        for subject in (
            self.non_owner_subject,
            self.anonymous_subject,
            self.staff_subject,
        ):
            with self.subTest(user_id=subject.user_id):
                decision = can(
                    subject,
                    "delete_note",
                    ReflectionNoteResource(self.owner_note.id),
                )
                self.assertFalse(decision)
                self.assertEqual(decision.denial.status_code, 404)

        staff_own = can(
            self.staff_subject, "list_notes", ReflectionNoteCollection()
        )
        self.assertTrue(staff_own)
        self.assertEqual(list(staff_own.value), [self.staff_note])

        create_anon = can(
            self.anonymous_subject,
            "create_note",
            ReflectionNoteCreation(owner_id=None),
        )
        self.assertFalse(create_anon)
        self.assertEqual(create_anon.denial.status_code, 401)

    def test_reading_position_is_self_only(self):
        owner = can(
            self.owner_subject, "view_reading_position", ReadingPositionCurrent()
        )
        self.assertTrue(owner)
        self.assertEqual(owner.value, self.owner_position)

        other = can(
            self.non_owner_subject,
            "save_reading_position",
            ReadingPositionCurrent(),
        )
        self.assertTrue(other)
        self.assertIsNone(other.value)

        staff_own = can(
            self.staff_subject, "view_reading_position", ReadingPositionCurrent()
        )
        self.assertEqual(staff_own.value, self.staff_position)

        anonymous = can(
            self.anonymous_subject,
            "save_reading_position",
            ReadingPositionCurrent(),
        )
        self.assertFalse(anonymous)
        self.assertEqual(anonymous.denial.status_code, 401)

    def test_personal_record_collection_and_create_are_owner_scoped(self):
        owner = can(
            self.owner_subject,
            "list_reading_records",
            PersonalReadingRecordCollection(),
        )
        self.assertTrue(owner)
        self.assertEqual(list(owner.value), [self.owner_record])

        staff_own = can(
            self.staff_subject,
            "view_reading_record_stats",
            PersonalReadingRecordCollection(),
        )
        self.assertEqual(list(staff_own.value), [self.staff_record])

        create_own = can(
            self.owner_subject,
            "record_reading",
            PersonalReadingRecordCreation(owner_id=self.owner.id),
        )
        create_other = can(
            self.non_owner_subject,
            "record_reading",
            PersonalReadingRecordCreation(owner_id=self.owner.id),
        )
        anonymous = can(
            self.anonymous_subject,
            "record_reading",
            PersonalReadingRecordCreation(owner_id=None),
        )
        self.assertTrue(create_own)
        self.assertFalse(create_other)
        self.assertEqual(create_other.denial.status_code, 404)
        self.assertFalse(anonymous)
        self.assertEqual(anonymous.denial.status_code, 401)


class ReadingGroupAuthzPolicyTest(TestCase):
    """Personas: outsider / member / admin / creator / anonymous."""

    def setUp(self):
        self.creator = User.objects.create_user(
            username="group-policy-creator",
            nickname="그룹정책생성자",
            password="pw-test-1234",
        )
        self.admin = User.objects.create_user(
            username="group-policy-admin",
            nickname="그룹정책관리자",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="group-policy-member",
            nickname="그룹정책멤버",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="group-policy-outsider",
            nickname="그룹정책외부",
            password="pw-test-1234",
        )
        self.public_group = ReadingGroup.objects.create(
            name="공개정책그룹",
            creator=self.creator,
            is_public=True,
        )
        self.private_group = ReadingGroup.objects.create(
            name="비공개정책그룹",
            creator=self.creator,
            is_public=False,
        )
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

        self.anonymous_subject = self._subject(AnonymousUser())
        self.creator_subject = self._subject(self.creator)
        self.admin_subject = self._subject(self.admin)
        self.member_subject = self._subject(self.member)
        self.outsider_subject = self._subject(self.outsider)

    def _subject(self, user):
        return subject_from_request(SimpleNamespace(user=user))

    def test_view_group_hides_private_group_from_outsider_and_anonymous(self):
        public_outsider = can(
            self.outsider_subject,
            "view_group",
            ReadingGroupResource(self.public_group.id),
        )
        private_member = can(
            self.member_subject,
            "view_group",
            ReadingGroupResource(self.private_group.id),
        )
        private_outsider = can(
            self.outsider_subject,
            "view_group",
            ReadingGroupResource(self.private_group.id),
        )
        private_anonymous = can(
            self.anonymous_subject,
            "view_group",
            ReadingGroupResource(self.private_group.id),
        )

        self.assertTrue(public_outsider)
        self.assertTrue(private_member)
        self.assertFalse(private_outsider)
        self.assertEqual(private_outsider.denial.status_code, 404)
        self.assertFalse(private_anonymous)
        self.assertEqual(private_anonymous.denial.status_code, 404)

    def test_leave_uses_creator_relation_not_admin_role(self):
        creator_leave = can(
            self.creator_subject,
            "leave",
            ReadingGroupResource(self.public_group.id),
        )
        member_leave = can(
            self.member_subject,
            "leave",
            ReadingGroupResource(self.public_group.id),
        )
        admin_leave = can(
            self.admin_subject,
            "leave",
            ReadingGroupResource(self.public_group.id),
        )
        outsider_public = can(
            self.outsider_subject,
            "leave",
            ReadingGroupResource(self.public_group.id),
        )
        outsider_private = can(
            self.outsider_subject,
            "leave",
            ReadingGroupResource(self.private_group.id),
        )

        self.assertFalse(creator_leave)
        self.assertEqual(creator_leave.denial.status_code, 400)
        self.assertEqual(
            creator_leave.denial.body["error"],
            "그룹 생성자는 탈퇴할 수 없습니다.",
        )
        self.assertTrue(member_leave)
        self.assertTrue(admin_leave)
        self.assertFalse(outsider_public)
        self.assertEqual(outsider_public.denial.status_code, 400)
        self.assertFalse(outsider_private)
        self.assertEqual(outsider_private.denial.status_code, 404)

    def test_invite_uses_admin_membership_role_not_creator(self):
        creator_invite = can(
            self.creator_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )
        admin_invite = can(
            self.admin_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )
        member_public = can(
            self.member_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )
        member_private = can(
            self.member_subject,
            "invite",
            ReadingGroupResource(self.private_group.id),
        )
        outsider_public = can(
            self.outsider_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )

        self.assertTrue(creator_invite)
        self.assertTrue(admin_invite)
        self.assertFalse(member_public)
        self.assertEqual(member_public.denial.status_code, 403)
        self.assertFalse(member_private)
        self.assertEqual(member_private.denial.status_code, 404)
        self.assertFalse(outsider_public)
        self.assertEqual(outsider_public.denial.status_code, 403)

    def test_creator_and_admin_role_diverge_after_creation(self):
        creator_membership = GroupMembership.objects.get(
            group=self.public_group, user=self.creator
        )
        creator_membership.role = "member"
        creator_membership.save(update_fields=["role"])

        creator_invite = can(
            self.creator_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )
        creator_leave = can(
            self.creator_subject,
            "leave",
            ReadingGroupResource(self.public_group.id),
        )
        admin_invite = can(
            self.admin_subject,
            "invite",
            ReadingGroupResource(self.public_group.id),
        )

        self.assertFalse(creator_invite)
        self.assertEqual(creator_invite.denial.status_code, 403)
        self.assertFalse(creator_leave)
        self.assertEqual(creator_leave.denial.status_code, 400)
        self.assertTrue(admin_invite)

    def test_join_preserves_private_hide_invite_and_capacity(self):
        public_join = can(
            self.outsider_subject,
            "join",
            ReadingGroupResource(self.public_group.id),
        )
        private_hidden = can(
            self.outsider_subject,
            "join",
            ReadingGroupResource(self.private_group.id),
        )
        already_member = can(
            self.member_subject,
            "join",
            ReadingGroupResource(self.public_group.id),
        )

        self.assertTrue(public_join)
        self.assertFalse(private_hidden)
        self.assertEqual(private_hidden.denial.status_code, 404)
        self.assertFalse(already_member)
        self.assertEqual(already_member.denial.status_code, 400)

        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.creator,
            invitee=self.outsider,
            status="pending",
        )
        invited = can(
            self.outsider_subject,
            "join",
            ReadingGroupResource(self.private_group.id),
        )
        self.assertTrue(invited)
        self.assertEqual(invited.value.pending_invitation, invitation)

        self.public_group.max_members = 1
        self.public_group.save(update_fields=["max_members"])
        full = can(
            self.outsider_subject,
            "join",
            ReadingGroupResource(self.public_group.id),
        )
        self.assertFalse(full)
        self.assertEqual(full.denial.status_code, 400)

    def test_visibility_is_own_active_membership(self):
        member_ok = can(
            self.member_subject,
            "update_profile_visibility",
            MembershipProfileVisibility(self.public_group.id),
        )
        outsider_hidden = can(
            self.outsider_subject,
            "update_profile_visibility",
            MembershipProfileVisibility(self.public_group.id),
        )

        self.assertTrue(member_ok)
        self.assertEqual(member_ok.value.user_id, self.member.id)
        self.assertFalse(outsider_hidden)
        self.assertEqual(outsider_hidden.denial.status_code, 404)
        self.assertEqual(outsider_hidden.denial.body, {"detail": "Not found."})

    def test_member_progress_and_scoreboard_preserve_404_vs_403(self):
        member_progress = can(
            self.member_subject,
            "view_member_progress",
            ReadingGroupMembershipResource(self.public_group.id),
        )
        outsider_public = can(
            self.outsider_subject,
            "view_member_progress",
            ReadingGroupMembershipResource(self.public_group.id),
        )
        outsider_private = can(
            self.outsider_subject,
            "view_member_progress",
            ReadingGroupMembershipResource(self.private_group.id),
        )
        private_scoreboard = can(
            self.outsider_subject,
            "view_group_scoreboard",
            GroupScoreboardResource(self.private_group.id),
        )
        public_scoreboard = can(
            self.outsider_subject,
            "view_group_scoreboard",
            GroupScoreboardResource(self.public_group.id),
        )

        self.assertTrue(member_progress)
        self.assertFalse(outsider_public)
        self.assertEqual(outsider_public.denial.status_code, 403)
        self.assertFalse(outsider_private)
        self.assertEqual(outsider_private.denial.status_code, 404)
        self.assertFalse(private_scoreboard)
        self.assertEqual(private_scoreboard.denial.status_code, 404)
        self.assertTrue(public_scoreboard)

    def test_list_groups_and_invitations_are_scoped_to_subject(self):
        outsider_list = can(
            self.outsider_subject,
            "list_groups",
            ReadingGroupCollection(),
        )
        member_list = can(
            self.member_subject,
            "list_groups",
            ReadingGroupCollection(),
        )
        self.assertTrue(outsider_list)
        self.assertEqual(
            set(outsider_list.value.values_list("id", flat=True)),
            {self.public_group.id},
        )
        self.assertEqual(
            set(member_list.value.values_list("id", flat=True)),
            {self.public_group.id, self.private_group.id},
        )

        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.creator,
            invitee=self.outsider,
            status="pending",
        )
        own = can(
            self.outsider_subject,
            "view_invitations",
            GroupInvitationCollection(),
        )
        other = can(
            self.member_subject,
            "view_invitations",
            GroupInvitationCollection(),
        )
        respond_own = can(
            self.outsider_subject,
            "respond_invitation",
            GroupInvitationResource(invitation.id),
        )
        respond_other = can(
            self.member_subject,
            "respond_invitation",
            GroupInvitationResource(invitation.id),
        )
        self.assertEqual(list(own.value), [invitation])
        self.assertEqual(list(other.value), [])
        self.assertTrue(respond_own)
        self.assertFalse(respond_other)
        self.assertEqual(respond_other.denial.status_code, 404)

    def test_create_group_and_profile_groups_require_matching_subject(self):
        created = can(
            self.member_subject,
            "create_group",
            ReadingGroupCreation(),
        )
        anonymous = can(
            self.anonymous_subject,
            "create_group",
            ReadingGroupCreation(),
        )
        own_profile = can(
            self.member_subject,
            "view_profile_groups",
            ProfileGroupsQuery(self.member.id),
        )
        other_profile = can(
            self.outsider_subject,
            "view_profile_groups",
            ProfileGroupsQuery(self.member.id),
        )
        missing = can(
            self.outsider_subject,
            "view_profile_groups",
            ProfileGroupsQuery(0),
        )

        self.assertTrue(created)
        self.assertFalse(anonymous)
        self.assertEqual(anonymous.denial.status_code, 401)
        self.assertTrue(own_profile)
        self.assertTrue(own_profile.value.is_own_profile)
        self.assertTrue(other_profile)
        self.assertFalse(other_profile.value.is_own_profile)
        self.assertFalse(missing)
        self.assertEqual(missing.denial.status_code, 404)

