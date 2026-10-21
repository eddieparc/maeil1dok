from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from threading import Event

from django.contrib.auth import get_user_model
from django.db import DataError, IntegrityError, close_old_connections, connection, connections, transaction
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.test import APIClient

from .models import GroupMembership, GroupPost, ReadingGroup


class GroupBoardApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.author, cls.member, cls.admin, cls.outsider, cls.inactive = [
            User.objects.create_user(
                username=f'board-{name}', nickname=name,
                email=f'{name}@example.com', password='board-test-only',
            )
            for name in ('author', 'member', 'admin', 'outsider', 'inactive')
        ]
        cls.group = ReadingGroup.objects.create(name='Board', creator=cls.outsider)
        cls.other_group = ReadingGroup.objects.create(
            name='Other board', creator=cls.admin, is_public=True,
        )
        for user, role, active in [
            (cls.author, 'member', True), (cls.member, 'member', True),
            (cls.admin, 'admin', True), (cls.inactive, 'admin', False),
        ]:
            GroupMembership.objects.create(
                group=cls.group, user=user, role=role, is_active=active,
            )
        GroupMembership.objects.create(group=cls.other_group, user=cls.author)
        cls.post = GroupPost.objects.create(
            group=cls.group, author=cls.author, title='First', content='Plain text\nSecond line',
        )
        cls.other_post = GroupPost.objects.create(
            group=cls.other_group, author=cls.author, title='Other', content='Other group',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.author)
        self.url = f'/api/v1/todos/groups/{self.group.pk}/posts/'
        self.detail = f'{self.url}{self.post.pk}/'

    def test_member_creates_persisted_server_owned_post(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(self.url, {'title': ' New ', 'content': ' Body '}, format='json')
        self.assertEqual(response.status_code, 201)
        post = GroupPost.objects.get(pk=response.data['post']['id'])
        self.assertEqual((post.group_id, post.author_id), (self.group.pk, self.member.pk))
        self.assertEqual((post.title, post.content), ('New', 'Body'))
        self.assertTrue(response.data['post']['can_edit'])
        self.assertTrue(response.data['post']['can_delete'])

    def test_detail_exposes_only_public_author_fields_and_flags(self):
        self.client.force_authenticate(self.member)
        response = self.client.get(self.detail)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'success', 'post'})
        post = response.data['post']
        self.assertEqual(set(post), {
            'id', 'group_id', 'title', 'content', 'author',
            'created_at', 'updated_at', 'can_edit', 'can_delete',
        })
        self.assertEqual(post['author'], {'id': self.author.pk, 'nickname': 'author'})
        self.assertFalse(post['can_edit'])
        self.assertFalse(post['can_delete'])
        self.assertEqual(post['content'], self.post.content)
        self.assertTrue(post['created_at'])
        self.assertTrue(post['updated_at'])

    def test_author_patch_persists_only_supplied_fields(self):
        old_time = datetime(2020, 1, 1)
        GroupPost.objects.filter(pk=self.post.pk).update(updated_at=old_time)
        response = self.client.patch(self.detail, {'title': 'Changed'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'Changed')
        self.assertEqual(self.post.content, 'Plain text\nSecond line')
        self.assertGreater(self.post.updated_at, old_time)
        self.assertEqual(response.data['post']['title'], self.post.title)

    def test_member_and_admin_cannot_edit_another_authors_post(self):
        for user in (self.member, self.admin):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)
                response = self.client.patch(self.detail, {'content': 'Stolen'}, format='json')
                self.assertEqual(response.status_code, 403)
                self.post.refresh_from_db()
                self.assertEqual(self.post.content, 'Plain text\nSecond line')

    def test_author_can_delete_and_response_retains_deleted_snapshot(self):
        response = self.client.delete(self.detail)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['post']['id'], self.post.pk)
        self.assertFalse(GroupPost.objects.filter(pk=self.post.pk).exists())
        self.assertTrue(GroupPost.objects.filter(pk=self.other_post.pk).exists())
        self.assertEqual(self.client.get(self.detail).status_code, 404)

    def test_active_admin_can_delete_without_being_creator(self):
        self.client.force_authenticate(self.admin)
        before = self.client.get(self.detail)
        self.assertFalse(before.data['post']['can_edit'])
        self.assertTrue(before.data['post']['can_delete'])
        response = self.client.delete(self.detail)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(GroupPost.objects.filter(pk=self.post.pk).exists())

    def test_ordinary_member_cannot_delete(self):
        self.client.force_authenticate(self.member)
        response = self.client.delete(self.detail)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(GroupPost.objects.filter(pk=self.post.pk).exists())

    def test_guests_nonmembers_and_inactive_members_cannot_access_any_operation(self):
        for public in (False, True):
            self.group.is_public = public
            self.group.save(update_fields=['is_public'])
            for user in (None, self.outsider, self.inactive):
                self.client.force_authenticate(user)
                for method, url, payload in [
                    ('get', self.url, {}), ('get', self.detail, {}),
                    ('post', self.url, {'title': 'Unauthorized', 'content': 'No'}),
                    ('patch', self.detail, {'title': 'Unauthorized'}),
                    ('delete', self.detail, {}),
                ]:
                    with self.subTest(public=public, user=user, method=method, url=url):
                        response = getattr(self.client, method)(url, payload, format='json')
                        self.assertEqual(response.status_code, 401 if user is None else 404)
                        self.assertNotIn('post', response.data)
                        self.assertNotIn('posts', response.data)
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'First')
        self.assertEqual(GroupPost.objects.count(), 2)

    def test_inactive_author_loses_all_post_access(self):
        GroupMembership.objects.filter(group=self.group, user=self.author).update(is_active=False)
        for method in ('get', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.detail, {'title': 'Changed'}, format='json')
                self.assertEqual(response.status_code, 404)
        self.assertTrue(GroupPost.objects.filter(pk=self.post.pk).exists())

    def test_admin_of_different_group_has_no_moderation_privilege(self):
        GroupMembership.objects.filter(group=self.group, user=self.admin).update(role='member')
        GroupMembership.objects.create(group=self.other_group, user=self.admin, role='admin')
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.detail)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(GroupPost.objects.filter(pk=self.post.pk).exists())

    def test_creator_and_staff_without_membership_have_no_override(self):
        self.outsider.is_staff = True
        self.outsider.save(update_fields=['is_staff'])
        self.client.force_authenticate(self.outsider)
        response = self.client.delete(self.detail)
        self.assertEqual(response.status_code, 404)
        self.assertTrue(GroupPost.objects.filter(pk=self.post.pk).exists())

    def test_cross_group_post_ids_are_hidden_even_from_the_author(self):
        url = f'{self.url}{self.other_post.pk}/'
        for method in ('get', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, {'title': 'Cross group'}, format='json')
                self.assertEqual(response.status_code, 404)
                self.assertNotIn('post', response.data)
        self.other_post.refresh_from_db()
        self.assertEqual(self.other_post.title, 'Other')

    def test_forged_identity_and_permission_fields_are_rejected(self):
        for key, value in [
            ('author', self.member.pk), ('author_id', self.member.pk),
            ('group', self.other_group.pk), ('group_id', self.other_group.pk),
            ('can_edit', True), ('can_delete', True),
        ]:
            for method, url in [('post', self.url), ('patch', self.detail)]:
                with self.subTest(key=key, method=method):
                    response = getattr(self.client, method)(
                        url, {'title': 'Forged', 'content': 'Body', key: value}, format='json',
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(key, response.data['errors'])
        self.post.refresh_from_db()
        self.assertEqual((self.post.author_id, self.post.group_id, self.post.title),
                         (self.author.pk, self.group.pk, 'First'))
        self.assertEqual(GroupPost.objects.count(), 2)

    def test_blank_overlong_null_and_structured_payloads_are_rejected(self):
        for field, limit in [('title', 200), ('content', 10000)]:
            for value in ('', ' \n\t ', 'x' * (limit + 1), None, [], {}, True):
                for method, url in [('post', self.url), ('patch', self.detail)]:
                    with self.subTest(field=field, value_type=type(value), method=method):
                        payload = {'title': 'Valid', 'content': 'Valid', field: value}
                        response = getattr(self.client, method)(url, payload, format='json')
                        self.assertEqual(response.status_code, 400)
                        self.assertIn(field, response.data['errors'])
        self.assertEqual(GroupPost.objects.count(), 2)
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'First')

    def test_create_requires_both_fields(self):
        for payload in ({}, {'title': 'Missing content'}, {'content': 'Missing title'}):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format='json')
                self.assertEqual(response.status_code, 400)
        self.assertEqual(GroupPost.objects.count(), 2)

    def test_exact_length_boundaries_and_plain_text_are_preserved(self):
        content = '<script>literal text, not HTML</script>\n'
        content += '가' * (10000 - len(content))
        response = self.client.post(
            self.url, {'title': '가' * 200, 'content': content}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        post = GroupPost.objects.get(pk=response.data['post']['id'])
        self.assertEqual(len(post.title), 200)
        self.assertEqual(post.content, content)
        self.assertEqual(response.data['post']['content'], content)

    def test_list_pagination_is_bounded_stable_and_group_scoped(self):
        GroupPost.objects.bulk_create([
            GroupPost(group=self.group, author=self.author, title=f'Post {i}', content='Text')
            for i in range(104)
        ])
        GroupPost.objects.filter(group=self.group).update(
            created_at=datetime(2020, 1, 1),
        )
        expected = list(GroupPost.objects.filter(group=self.group).order_by('-id').values_list('id', flat=True))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'success', 'count', 'next', 'previous', 'posts'})
        self.assertEqual(response.data['count'], 105)
        self.assertEqual([p['id'] for p in response.data['posts']], expected[:20])
        self.assertIsNone(response.data['previous'])
        second = self.client.get(response.data['next'])
        self.assertEqual([p['id'] for p in second.data['posts']], expected[20:40])
        self.assertIsNotNone(second.data['previous'])
        large = self.client.get(self.url, {'page_size': 100})
        self.assertEqual(len(large.data['posts']), 100)
        last = self.client.get(large.data['next'])
        self.assertEqual([p['id'] for p in last.data['posts']], expected[100:])
        self.assertIsNone(last.data['next'])
        self.assertNotIn(self.other_post.pk, expected)

    def test_invalid_pagination_is_rejected(self):
        for query in (
            {'page_size': 101}, {'page_size': 0}, {'page_size': -1},
            {'page_size': 'all'}, {'page': 0}, {'page': -1}, {'page': 'bad'},
        ):
            with self.subTest(query=query):
                self.assertEqual(self.client.get(self.url, query).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'page': 99}).status_code, 404)

    def test_empty_board_has_explicit_empty_pagination(self):
        GroupPost.objects.filter(group=self.group).delete()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            'success': True, 'count': 0, 'next': None, 'previous': None, 'posts': [],
        })

    def test_database_rejects_empty_and_overlong_post_fields(self):
        for field, value in [
            ('title', ''), ('title', ' '), ('title', 'x' * 201),
            ('content', ''), ('content', ' '), ('content', 'x' * 10001),
        ]:
            with self.subTest(field=field, length=len(value)):
                with self.assertRaises((DataError, IntegrityError)), transaction.atomic():
                    GroupPost.objects.create(
                        group=self.group, author=self.author,
                        **{'title': 'Valid', 'content': 'Valid', field: value},
                    )

    def test_unicode_limits_count_characters_not_utf8_bytes(self):
        response = self.client.post(
            self.url, {'title': '\U0001f600' * 200, 'content': '\U0001f600' * 10000},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        post = GroupPost.objects.get(pk=response.data['post']['id'])
        self.assertEqual((len(post.title), len(post.content)), (200, 10000))
        for field, limit in [('title', 200), ('content', 10000)]:
            with self.subTest(field=field):
                response = self.client.patch(
                    f'{self.url}{post.pk}/', {field: '\U0001f600' * (limit + 1)}, format='json',
                )
                self.assertEqual(response.status_code, 400)


@skipUnlessDBFeature('has_select_for_update')
class GroupBoardMembershipRaceTest(TransactionTestCase):
    def test_revocation_committed_before_lock_acquisition_denies_every_write(self):
        author = get_user_model().objects.create_user(
            username='board-race', nickname='Author',
            email='board-race@example.com', password='board-test-only',
        )
        group = ReadingGroup.objects.create(name='Race board', creator=author)
        membership = GroupMembership.objects.create(group=group, user=author)
        post = GroupPost.objects.create(group=group, author=author, title='Original', content='Body')
        base = f'/api/v1/todos/groups/{group.pk}/posts/'

        for method in ('post', 'patch', 'delete'):
            with self.subTest(method=method), ThreadPoolExecutor(max_workers=1) as executor:
                GroupMembership.objects.filter(pk=membership.pk).update(is_active=True)
                lock_requested = Event()

                def write():
                    close_old_connections()
                    try:
                        client = APIClient()
                        client.force_authenticate(author)

                        def observe(execute, sql, params, many, context):
                            if 'todos_groupmembership' in sql and 'FOR UPDATE' in sql:
                                lock_requested.set()
                            return execute(sql, params, many, context)

                        with connection.execute_wrapper(observe):
                            return getattr(client, method)(
                                base if method == 'post' else f'{base}{post.pk}/',
                                {'title': 'Unauthorized', 'content': 'Changed'}, format='json',
                            ).status_code
                    finally:
                        connections.close_all()

                with transaction.atomic():
                    GroupMembership.objects.select_for_update().get(pk=membership.pk)
                    future = executor.submit(write)
                    self.assertTrue(lock_requested.wait(timeout=5), 'write must lock its membership')
                    GroupMembership.objects.filter(pk=membership.pk).update(is_active=False)
                self.assertEqual(future.result(timeout=5), 404)
                self.assertEqual(GroupPost.objects.filter(group=group).count(), 1)
                post.refresh_from_db()
                self.assertEqual((post.title, post.content), ('Original', 'Body'))
