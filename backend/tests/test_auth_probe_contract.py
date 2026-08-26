"""`/auth/user/` is the canonical current-user contract; `/auth/verify/` mirrors it.

Two routes report the current user:

- `/api/v1/auth/user/` — canonical. Returns the user payload directly.
- `/api/v1/auth/verify/` — deprecated probe. Returns the same payload wrapped in
  `{authenticated, user}`.

Both are consumed by the web client's auth guard, so neither can be removed
without a client deployment. What must hold instead is that they cannot drift:
the user payload has to stay identical, field for field. A change to the
canonical serializer that forgets the probe would otherwise ship two different
answers to "who am I".

These assert the relationship between the two responses rather than a frozen
field list, so adding a field to `UserSerializer` keeps them passing while
letting them fail the moment the two routes disagree.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()

CANONICAL_URL = '/api/v1/auth/user/'
PROBE_URL = '/api/v1/auth/verify/'


class AuthProbeContractTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='probe-user', password='pw-probe-1234', nickname='probe'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_probe_reports_the_same_user_payload_as_the_canonical_route(self):
        canonical = self.client.get(CANONICAL_URL)
        probe = self.client.get(PROBE_URL)

        self.assertEqual(canonical.status_code, 200)
        self.assertEqual(probe.status_code, 200)
        self.assertEqual(probe.json()['user'], canonical.json())

    def test_probe_envelope_is_unchanged(self):
        probe = self.client.get(PROBE_URL)
        self.assertEqual(probe.status_code, 200)
        self.assertEqual(set(probe.json()), {'authenticated', 'user'})
        self.assertIs(probe.json()['authenticated'], True)

    def test_canonical_route_identifies_the_authenticated_caller(self):
        canonical = self.client.get(CANONICAL_URL)
        self.assertEqual(canonical.status_code, 200)
        self.assertEqual(canonical.json()['id'], self.user.id)

    def test_both_routes_reject_anonymous_callers_identically(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get(CANONICAL_URL).status_code, 401)
        self.assertEqual(anonymous.get(PROBE_URL).status_code, 401)

    def test_probe_reports_the_caller_not_a_fixed_user(self):
        other = User.objects.create_user(
            username='other-probe-user', password='pw-other-1234', nickname='other'
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other)

        self.assertEqual(self.client.get(PROBE_URL).json()['user']['id'], self.user.id)
        self.assertEqual(other_client.get(PROBE_URL).json()['user']['id'], other.id)

    def test_probe_points_callers_at_the_canonical_route(self):
        """The redirection must be visible to clients, not just in a code comment.

        Generated client types come from schema.yml, so the published description is
        the only signal a consumer sees. The OpenAPI `deprecated` flag is deliberately
        NOT used here: in this schema it distinguishes the `/accounts/` compatibility
        alias from the canonical `/auth/` route, and tests.test_openapi_schema asserts
        exactly one of each pair carries it. Overloading it would destroy that signal.
        """
        from django.core.management import call_command
        from io import StringIO
        import yaml

        buffer = StringIO()
        call_command('spectacular', '--format', 'openapi', stdout=buffer)
        schema = yaml.safe_load(buffer.getvalue())

        probe = schema['paths'][PROBE_URL]['get']
        self.assertIn('/api/v1/auth/user/', probe['description'])
        self.assertIn('canonical', probe['description'])
