"""Logout must invalidate handoff codes that were issued but not yet redeemed.

A session-bridge code is a one-shot credential that mints WebView auth cookies.
If logout leaves an outstanding code redeemable, a code arriving moments later
revives the session the user just ended -- the app looks signed in again right
after signing out.

The mechanism is a per-user logout instant plus an issue instant stamped on each
code, compared at redemption. These tests pin the properties that made that
choice necessary:

- a code issued **before** the logout is rejected, including one issued while the
  logout request was still in flight (an enumeration-based approach loses this
  one, which is why it was not used);
- a code issued **after** the logout still works, so signing back in is not
  broken;
- a legacy code with no issue stamp is rejected conservatively, because it cannot
  prove it postdates the logout;
- the redemption path reads both the legacy bare-int and the new dict shape, so
  handoffs in flight survive the deploy that introduces this.
"""

import time
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from accounts import handoff
from accounts.authentication import get_tokens_for_user
from accounts.views import _consume_session_bridge_user_id

User = get_user_model()

ISSUE_URL = '/api/v1/auth/session/issue/'
CONSUME_URL = '/api/v1/auth/session/consume/'
LOGOUT_URL = '/api/v1/auth/logout/'
LOGOUT_ALL_URL = '/api/v1/auth/logout-all/'


class HandoffInvalidationTest(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='handoff', password='pw-handoff-1234', nickname='handoff'
        )
        self.tokens = get_tokens_for_user(self.user)

    def tearDown(self):
        cache.clear()

    def _authed_client(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        return client

    def _issue_code(self):
        response = self._authed_client().post(ISSUE_URL, {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['code']

    def test_code_issued_before_logout_is_rejected(self):
        code = self._issue_code()
        handoff.mark_logged_out(cache, self.user.id)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_code_issued_after_logout_still_works(self):
        """Signing back in must not be broken by the invalidation marker."""
        handoff.mark_logged_out(cache, self.user.id, now=time.time() - 5)
        code = self._issue_code()

        self.assertEqual(_consume_session_bridge_user_id(cache, code), self.user.id)

    def test_code_issued_at_the_same_instant_as_logout_is_rejected(self):
        """Ties go to the logout: reviving an ended session is the worse error."""
        moment = time.time()
        code = str(uuid.uuid4())
        cache.set(
            f'session_bridge:{code}',
            handoff.build_code_payload(self.user.id, now=moment),
            timeout=60,
        )
        handoff.mark_logged_out(cache, self.user.id, now=moment)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_logout_endpoint_invalidates_an_outstanding_code(self):
        """End to end through real HTTP, not just the helper."""
        code = self._issue_code()

        logout = self._authed_client().post(LOGOUT_URL, {}, format='json')
        self.assertEqual(logout.status_code, 200)

        # The consume route is a GET that redirects; an invalidated code must not
        # set auth cookies regardless of the redirect target.
        consumed = APIClient().get(CONSUME_URL, {'code': code})
        self.assertNotIn('access_token', consumed.cookies)

    def test_logout_all_devices_invalidates_an_outstanding_code(self):
        """token_version does not cover cached codes, so this needs its own marker."""
        code = self._issue_code()

        logout = self._authed_client().post(LOGOUT_ALL_URL, {}, format='json')
        self.assertEqual(logout.status_code, 200)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_logout_without_credentials_still_marks_via_refresh_token(self):
        """The endpoint is AllowAny so an expired access token can still log out.

        The user is then identified from the refresh token's unverified payload;
        without that fallback the marker would never be written for the very
        clients most likely to need it.
        """
        code = self._issue_code()

        anonymous = APIClient()
        anonymous.cookies['refresh_token'] = self.tokens['refresh']
        logout = anonymous.post(LOGOUT_URL, {}, format='json')
        self.assertEqual(logout.status_code, 200)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_another_users_code_is_unaffected(self):
        """The marker is per user; one logout must not sign everyone else out."""
        other = User.objects.create_user(
            username='other-handoff', password='pw-other-1234', nickname='other'
        )
        other_tokens = get_tokens_for_user(other)
        other_client = APIClient()
        other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_tokens['access']}")
        other_code = other_client.post(ISSUE_URL, {}, format='json').data['code']

        self._authed_client().post(LOGOUT_URL, {}, format='json')

        self.assertEqual(_consume_session_bridge_user_id(cache, other_code), other.id)


class LegacyCodeShapeTest(TestCase):
    """Codes already in the cache at deploy time hold a bare int, not a dict."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='legacy', password='pw-legacy-1234', nickname='legacy'
        )

    def tearDown(self):
        cache.clear()

    def test_legacy_code_redeems_when_no_logout_happened(self):
        """Rejecting it outright would break every handoff in flight at deploy."""
        code = str(uuid.uuid4())
        cache.set(f'session_bridge:{code}', self.user.id, timeout=60)

        self.assertEqual(_consume_session_bridge_user_id(cache, code), self.user.id)

    def test_legacy_code_is_rejected_after_a_logout(self):
        """It cannot prove it postdates the logout, so it loses."""
        code = str(uuid.uuid4())
        cache.set(f'session_bridge:{code}', self.user.id, timeout=60)
        handoff.mark_logged_out(cache, self.user.id)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_boolean_stored_value_is_not_mistaken_for_a_user_id(self):
        """`isinstance(True, int)` is true; `id=True` would resolve to user 1."""
        code = str(uuid.uuid4())
        cache.set(f'session_bridge:{code}', True, timeout=60)

        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

    def test_corrupt_payload_shapes_are_rejected(self):
        for value in ({}, {'issued_at': 1}, 'seven', [7], None):
            with self.subTest(value=value):
                code = str(uuid.uuid4())
                cache.set(f'session_bridge:{code}', value, timeout=60)
                self.assertIsNone(_consume_session_bridge_user_id(cache, code))


class HandoffHelperTest(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_marker_ttl_outlives_a_code_ttl(self):
        """If the marker expired first, old codes would become valid again."""
        from accounts.views import SESSION_BRIDGE_TTL_SECONDS

        self.assertGreater(
            handoff.LOGOUT_MARKER_TTL_SECONDS, SESSION_BRIDGE_TTL_SECONDS * 10
        )

    def test_no_marker_means_nothing_is_invalidated(self):
        self.assertFalse(handoff.code_is_invalidated_by_logout(cache, 42, time.time()))

    def test_read_code_payload_normalises_both_shapes(self):
        user_id, issued_at = handoff.read_code_payload(7)
        self.assertEqual((user_id, issued_at), (7, None))

        stamped = handoff.build_code_payload(7, now=1000.0)
        self.assertEqual(handoff.read_code_payload(stamped), (7, 1000.0))

    def test_unparseable_issued_at_degrades_to_none(self):
        """Falling back to `None` makes the code lose, not silently pass."""
        user_id, issued_at = handoff.read_code_payload(
            {'user_id': 7, 'issued_at': 'lunchtime'}
        )
        self.assertEqual(user_id, 7)
        self.assertIsNone(issued_at)
        handoff.mark_logged_out(cache, 7)
        self.assertTrue(handoff.code_is_invalidated_by_logout(cache, 7, issued_at))
