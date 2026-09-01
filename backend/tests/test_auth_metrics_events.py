"""Auth events must carry the dimensions the rollback gates read.

Every assertion here drives real HTTP and then reads the recorded row. That
matters more than usual: the pipeline is happy to record events with an empty
`method` -- status codes stay correct, rows accumulate, nothing raises -- so a
test that only checked "an event exists" would pass while the dimension the gate
depends on is blank.

Two things are pinned that cost real debugging time:

- `method` is published on the *underlying* `HttpRequest`. DRF hands the auth
  class a wrapper, and middleware only ever sees the wrapped request, so tagging
  the wrapper silently yields `method=none`.
- The refresh view prefers the **cookie** over the request body. A client that
  keeps cookies between calls therefore rotates successfully on a second call
  instead of exercising the blacklisted body token. The app shell sends the
  stored token in the body *without* a cookie, which is exactly the bug path, so
  the north-star test must use a cookie-free client.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.authentication import ACCESS_TOKEN_COOKIE, get_tokens_for_user
from authmetrics import refresh as refresh_metrics
from authmetrics.clients import (
    CLIENT_LEGACY_SHELL,
    CLIENT_SHELL,
    CLIENT_UNKNOWN,
    CLIENT_WEB,
    classify_client,
    shell_patterns_are_configured,
)
from authmetrics.models import (
    AgeBucket,
    AuthEventOutbox,
    AuthMethod,
    EventKind,
    Outcome,
    RouteBucket,
)

User = get_user_model()

USER_URL = '/api/v1/auth/user/'
REFRESH_URL = '/api/v1/auth/token/refresh/'


def events(**filters):
    return list(AuthEventOutbox.objects.filter(**filters).order_by('id'))


class AuthMethodTaggingTest(TestCase):
    """`method` must distinguish the three ways a request reaches the auth surface."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='tagged', password='pw-tagging-1234', nickname='tagged'
        )
        self.tokens = get_tokens_for_user(self.user)

    def test_header_auth_is_tagged_header_access_jwt(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        self.assertEqual(client.get(USER_URL).status_code, 200)

        event = events(event=EventKind.AUTH)[-1]
        self.assertEqual(event.method, AuthMethod.HEADER_ACCESS_JWT)
        self.assertEqual(event.outcome, Outcome.SUCCESS)
        self.assertEqual(event.status, 200)
        self.assertEqual(event.route_bucket, RouteBucket.AUTH_USER)

    def test_cookie_auth_is_tagged_cookie_access_jwt(self):
        """Cookie and header are separate values even though both carry a JWT.

        Labelling the cookie path `session` would claim a capability Part A has
        not built, and Part B's real session would then have no distinct value.
        """
        client = APIClient()
        client.cookies[ACCESS_TOKEN_COOKIE] = self.tokens['access']
        self.assertEqual(client.get(USER_URL).status_code, 200)

        event = events(event=EventKind.AUTH)[-1]
        self.assertEqual(event.method, AuthMethod.COOKIE_ACCESS_JWT)

    def test_unauthenticated_request_is_tagged_none_and_fails(self):
        self.assertEqual(APIClient().get(USER_URL).status_code, 401)

        event = events(event=EventKind.AUTH)[-1]
        self.assertEqual(event.method, AuthMethod.NONE)
        self.assertEqual(event.outcome, Outcome.FAIL)
        self.assertEqual(event.status, 401)

    def test_the_three_methods_are_distinct(self):
        header = APIClient()
        header.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        header.get(USER_URL)

        cookie = APIClient()
        cookie.cookies[ACCESS_TOKEN_COOKIE] = self.tokens['access']
        cookie.get(USER_URL)

        APIClient().get(USER_URL)

        recorded = [event.method for event in events(event=EventKind.AUTH)]
        self.assertEqual(len(set(recorded)), 3, recorded)

    def test_success_and_non_401_failure_are_distinguishable(self):
        """401 must be separable from other failures.

        The rollback rule watches the 401 rate; if a 403 landed in the same
        bucket, an unrelated CSRF regression would read as an auth regression.
        """
        # `enforce_csrf_checks=True` is required: the default test client skips
        # CSRF entirely, so a cookie-only POST would return 200 and this test
        # would assert nothing about the 403 path.
        cookie = APIClient(enforce_csrf_checks=True)
        cookie.cookies['refresh_token'] = self.tokens['refresh']
        forbidden = cookie.post(REFRESH_URL, {}, format='json')
        self.assertEqual(forbidden.status_code, 403)

        statuses = {event.status for event in events(outcome=Outcome.FAIL)}
        self.assertIn(403, statuses)
        self.assertNotIn(401, statuses)


class ClientClassificationTest(TestCase):
    def test_declared_header_wins(self):
        for declared, expected in (('web', CLIENT_WEB), ('shell', CLIENT_SHELL)):
            with self.subTest(declared=declared):
                self.assertEqual(
                    classify_client(declared=declared, user_agent='Mozilla/5.0'),
                    expected,
                )

    def test_unrecognised_declared_value_is_ignored(self):
        """A typo or hostile value must not invent a cohort."""
        self.assertEqual(
            classify_client(declared='definitely-not-a-client', user_agent=None),
            CLIENT_UNKNOWN,
        )

    def test_header_reaches_the_recorded_event(self):
        user = User.objects.create_user(
            username='declared', password='pw-declared-1234', nickname='declared'
        )
        tokens = get_tokens_for_user(user)
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}", HTTP_X_CLIENT='shell'
        )
        client.get(USER_URL)

        self.assertEqual(events(event=EventKind.AUTH)[-1].client, CLIENT_SHELL)

    def test_headerless_requests_are_unknown_until_signatures_are_measured(self):
        """Honest `unknown` beats a guessed cohort.

        The four shell signatures (iOS/Android x WebView/native) differ, so a
        partial pattern set would bucket the rest as `unknown` anyway while making
        the numbers look authoritative. The baseline gate reads
        `shell_patterns_are_configured()` to refuse collection until the operator
        records the real strings.
        """
        self.assertFalse(shell_patterns_are_configured())
        self.assertEqual(
            classify_client(declared=None, user_agent='okhttp/4.9.2'), CLIENT_UNKNOWN
        )

    def test_legacy_shell_is_never_merged_into_unknown(self):
        """They are different answers and the cohort split depends on it."""
        self.assertNotEqual(CLIENT_LEGACY_SHELL, CLIENT_UNKNOWN)


class LoginEventTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='logger', password='pw-login-1234', nickname='logger'
        )

    def test_login_success_and_failure_are_separate_outcomes(self):
        """Success *rate* needs both a numerator and a denominator."""
        client = APIClient()
        ok = client.post(
            '/api/v1/auth/token/',
            {'username': 'logger', 'password': 'pw-login-1234'},
            format='json',
        )
        self.assertEqual(ok.status_code, 200)

        bad = APIClient().post(
            '/api/v1/auth/token/',
            {'username': 'logger', 'password': 'wrong-password'},
            format='json',
        )
        self.assertEqual(bad.status_code, 401)

        outcomes = [event.outcome for event in events(event=EventKind.LOGIN)]
        self.assertIn(Outcome.SUCCESS, outcomes)
        self.assertIn(Outcome.FAIL, outcomes)

    def test_login_is_not_recorded_as_an_auth_event(self):
        """Conflating them would break the rate: "already signed in" is not an attempt."""
        APIClient().post(
            '/api/v1/auth/token/',
            {'username': 'logger', 'password': 'pw-login-1234'},
            format='json',
        )
        self.assertTrue(events(event=EventKind.LOGIN))
        self.assertFalse(
            events(event=EventKind.AUTH, route_bucket=RouteBucket.AUTH_LOGIN)
        )

    def test_social_signup_completion_is_recorded_as_login_attempt(self):
        response = APIClient().post(
            '/api/v1/auth/complete-social-signup/',
            {
                'provider': 'google',
                'provider_id': 'unverified-provider',
                'nickname': '메트릭가입독자',
            },
            format='json',
            HTTP_X_CLIENT='legacy-shell',
            HTTP_X_APP_PLATFORM='android',
        )

        self.assertEqual(response.status_code, 400)
        event = events(event=EventKind.LOGIN)[-1]
        self.assertEqual(event.route_bucket, RouteBucket.AUTH_LOGIN)
        self.assertEqual(event.client, CLIENT_LEGACY_SHELL)
        self.assertEqual(event.outcome, Outcome.FAIL)
        self.assertEqual(event.status, 400)


class RefreshRejectionCauseTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='refresher', password='pw-refresh-1234', nickname='refresher'
        )
        self.tokens = get_tokens_for_user(self.user)

    def test_missing_token_is_its_own_cause(self):
        response = APIClient().post(REFRESH_URL, {}, format='json')
        self.assertEqual(response.status_code, 400)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_MISSING_TOKEN)
        self.assertEqual(event.status, 400)

    def test_malformed_token_is_its_own_cause(self):
        response = APIClient().post(
            REFRESH_URL, {'refresh': 'not.a.jwt'}, format='json'
        )
        self.assertEqual(response.status_code, 401)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_MALFORMED)

    def test_blacklisted_young_token_is_the_north_star_signal(self):
        """The fingerprint of the bug this migration exists to fix.

        Uses a fresh client for isolation only. It used to be *required*, because
        the view preferred the cookie and a client holding the rotation response's
        cookie would rotate again and never exercise the body token. That
        precedence was reversed on 2026-08-30 (see the test below), so the body
        token is now what gets judged either way.
        """
        rotator = APIClient()
        rotated = rotator.post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(rotated.status_code, 200)
        self.assertNotEqual(rotated.data['refresh'], self.tokens['refresh'])

        replay = APIClient().post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(replay.status_code, 401)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_BLACKLISTED)
        self.assertEqual(event.status, 401)
        self.assertEqual(
            event.age_bucket,
            AgeBucket.LT_30D,
            'a freshly issued token must not be bucketed as old or unknown; '
            'without a real age the north-star predicate cannot be evaluated',
        )

    def test_the_body_token_takes_precedence_over_the_cookie(self):
        """Precedence reversed 2026-08-30. Pinned here because it is deliberate.

        It used to be cookie-over-body. Two measured reasons overturned that:

        1. **The cookie path was unreachable for the shell.** Redeeming by cookie
           requires CSRF, and the shell's native `fetch` sends neither `Origin` nor
           `Referer`, so Django's check can never pass. Because the shell also
           attaches the cookie (`sharedCookiesEnabled` + `credentials: 'include'`),
           cookie precedence meant **every** shell redemption was answered 403 and
           the body token it did send was never read.
        2. **Cookie precedence masked the north-star signal.** A shell holding a
           stale stored token beside a fresh cookie rotated the cookie and looked
           healthy, so `refresh_401{cause=blacklisted}` -- the whole point of the
           measurement -- could not fire. The docstring of the test above admitted
           exactly this.

        The reverse design (read the cookie but let a body token waive CSRF) was
        rejected: an attacker could present *their own* valid token to waive the
        check and have the victim's cookie rotated. With body precedence, a token
        an attacker supplies only ever refreshes that attacker's own session.
        """
        client = APIClient()
        first = client.post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(first.status_code, 200)

        # The cookie now holds the rotated token, but the body still carries the
        # original -- which rotation blacklisted. The body is what gets judged.
        second = client.post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(second.status_code, 401)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(
            event.cause,
            refresh_metrics.CAUSE_BLACKLISTED,
            'the replayed body token must surface as the north-star cause, not be '
            'hidden behind a still-valid cookie',
        )

    def test_stale_generation_is_its_own_cause(self):
        """Revocation by token-version bump must not be labelled `blacklisted`."""
        self.user.token_version += 1
        self.user.save(update_fields=['token_version'])

        response = APIClient().post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(response.status_code, 401)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_STALE_GENERATION)

    def test_inactive_user_is_its_own_cause(self):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])

        response = APIClient().post(
            REFRESH_URL, {'refresh': self.tokens['refresh']}, format='json'
        )
        self.assertEqual(response.status_code, 401)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_USER_INACTIVE)

    def test_csrf_rejection_is_recorded_as_403_not_401(self):
        """A CSRF failure is not an auth failure; mixing them skews the 401 rate."""
        # See the note in AuthMethodTaggingTest: the default client bypasses CSRF.
        client = APIClient(enforce_csrf_checks=True)
        client.cookies['refresh_token'] = self.tokens['refresh']
        response = client.post(REFRESH_URL, {}, format='json')
        self.assertEqual(response.status_code, 403)

        event = events(event=EventKind.REFRESH_401)[-1]
        self.assertEqual(event.cause, refresh_metrics.CAUSE_CSRF)
        self.assertEqual(event.status, 403)

    def test_every_recorded_cause_is_in_the_declared_enum(self):
        """Guards against a free-form string exploding counter cardinality."""
        APIClient().post(REFRESH_URL, {}, format='json')
        APIClient().post(REFRESH_URL, {'refresh': 'not.a.jwt'}, format='json')

        for event in events(event=EventKind.REFRESH_401):
            self.assertIn(event.cause, refresh_metrics.ALL_CAUSES)


class RefreshAgeMeasurementTest(TestCase):
    def test_age_comes_from_the_token_iat(self):
        issued = timezone.now() - timedelta(days=3)
        payload = {'iat': issued.timestamp()}
        age = refresh_metrics.refresh_age_seconds(payload)
        self.assertIsNotNone(age)
        self.assertAlmostEqual(age, 3 * 86400, delta=120)

    def test_missing_or_broken_iat_yields_none_not_zero(self):
        """Zero would read as brand-new and land in the bucket the gate watches."""
        for payload in ({}, {'iat': None}, {'iat': 'yesterday'}, None, 'nope'):
            with self.subTest(payload=payload):
                self.assertIsNone(refresh_metrics.refresh_age_seconds(payload))

    def test_future_iat_is_not_trusted(self):
        future = {'iat': (timezone.now() + timedelta(hours=2)).timestamp()}
        self.assertIsNone(refresh_metrics.refresh_age_seconds(future))

    def test_unverified_payload_reads_iat_without_validating_the_token(self):
        """Needed because the blacklist branch raises before a payload exists.

        The value only picks an enum bucket -- it never authenticates anyone.
        """
        tokens = get_tokens_for_user(
            User.objects.create_user(
                username='ager', password='pw-age-1234', nickname='ager'
            )
        )
        payload = refresh_metrics.unverified_payload(tokens['refresh'])
        self.assertIsNotNone(payload)
        self.assertIn('iat', payload)

    def test_unverified_payload_rejects_non_jwt_input(self):
        for value in ('', 'a.b', 'not-a-jwt', None, 12345, 'a.!!!.c'):
            with self.subTest(value=value):
                self.assertIsNone(refresh_metrics.unverified_payload(value))


class TokenErrorClassificationTest(TestCase):
    def test_known_messages_map_to_specific_causes(self):
        cases = (
            ('Token is blacklisted', refresh_metrics.CAUSE_BLACKLISTED),
            ('Token is expired', refresh_metrics.CAUSE_EXPIRED),
            ('Token is invalid or expired', refresh_metrics.CAUSE_EXPIRED),
            ('Signature verification failed', refresh_metrics.CAUSE_MALFORMED),
        )
        for message, expected in cases:
            with self.subTest(message=message):
                self.assertEqual(
                    refresh_metrics.classify_token_error(Exception(message)), expected
                )

    def test_unrecognised_message_falls_through_to_other(self):
        """Message matching is fragile, so unknown text must not be guessed."""
        self.assertEqual(
            refresh_metrics.classify_token_error(Exception('something new')),
            refresh_metrics.CAUSE_OTHER,
        )


class MetricsFailureIsolationTest(TestCase):
    def test_a_recording_failure_does_not_break_authentication(self):
        """A metrics outage must never turn a login into a 5xx."""
        user = User.objects.create_user(
            username='isolated', password='pw-isolated-1234', nickname='isolated'
        )
        tokens = get_tokens_for_user(user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        with self.settings(DATABASES_FAILURE_SIMULATION=True):
            from unittest.mock import patch

            with patch(
                'authmetrics.middleware.record_auth_event',
                side_effect=RuntimeError('metrics down'),
            ):
                response = client.get(USER_URL)

        self.assertEqual(response.status_code, 200)
