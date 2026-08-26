"""`.json` suffix aliases must not return 5xx.

DRF's `format_suffix_patterns` generates a `.<format>` alias for every routed
view and passes the captured suffix to the handler as a keyword argument. A
`@action` method whose signature omits `format` therefore raises
`TypeError: ... got an unexpected keyword argument 'format'` and the request
becomes a 500 -- on a public path, for anyone who appends `.json`.

The characterization golden does not cover these routes (it records zero `.json`
entries), so this file is the only thing standing between a signature change and
21 silently broken endpoints.

The assertion is deliberately "not 5xx" rather than an exact status: 400 from a
missing query parameter and 403 from an admin-only viewset are both correct
answers. What must never happen is the server failing to process the request at
all.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import get_resolver
from rest_framework.test import APIClient

User = get_user_model()


def format_suffix_patterns_in_urlconf():
    """Every routed pattern that captures a `format` suffix."""
    found = []

    def walk(resolver, prefix=''):
        for entry in resolver.url_patterns:
            pattern = prefix + str(entry.pattern)
            if hasattr(entry, 'url_patterns'):
                walk(entry, pattern)
            elif '(?P<format>' in pattern:
                found.append(pattern)

    walk(get_resolver())
    return found


# Concrete `.json` URLs, one per shape the aliases take. Detail routes need a real
# primary key, so they are exercised through the list endpoints' own actions
# instead of guessed ids.
COLLECTION_URLS = (
    '/api/v1/todos/bible-plans.json',
    '/api/v1/todos/bible/bookmarks.json',
    '/api/v1/todos/bible/bookmarks/by-chapter.json',
    '/api/v1/todos/bible/bookmarks/delete-all.json',
    '/api/v1/todos/bible/notes.json',
    '/api/v1/todos/bible/notes/by-chapter.json',
    '/api/v1/todos/bible/notes/delete-all.json',
    '/api/v1/todos/bible/highlights.json',
    '/api/v1/todos/bible/highlights/by-chapter.json',
    '/api/v1/todos/bible/highlights/delete-all.json',
    '/api/v1/todos/bible/personal-records.json',
    '/api/v1/todos/bible/personal-records/by-book.json',
    '/api/v1/todos/bible/personal-records/dates.json',
    '/api/v1/todos/bible/personal-records/stats.json',
)


class FormatSuffixRouteTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='suffix', password='pw-suffix-1234', nickname='suffix'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_the_urlconf_still_generates_format_aliases(self):
        """If this drops to zero the rest of the file stops testing anything."""
        self.assertGreater(len(format_suffix_patterns_in_urlconf()), 0)

    def test_no_collection_alias_returns_5xx(self):
        failures = []
        for url in COLLECTION_URLS:
            response = self.client.get(url)
            if response.status_code >= 500:
                failures.append((url, response.status_code))
        self.assertEqual(failures, [], f'format aliases returned 5xx: {failures}')

    def test_no_collection_alias_returns_5xx_for_anonymous_callers(self):
        """The alias is reachable without credentials, so it must be safe there too."""
        anonymous = APIClient()
        failures = []
        for url in COLLECTION_URLS:
            response = anonymous.get(url)
            if response.status_code >= 500:
                failures.append((url, response.status_code))
        self.assertEqual(failures, [], f'format aliases returned 5xx: {failures}')

    def test_delete_all_aliases_do_not_5xx_on_their_real_method(self):
        """`delete-all` is a DELETE action; a GET would exit before the handler."""
        for url in (
            '/api/v1/todos/bible/bookmarks/delete-all.json',
            '/api/v1/todos/bible/notes/delete-all.json',
            '/api/v1/todos/bible/highlights/delete-all.json',
        ):
            with self.subTest(url=url):
                self.assertLess(self.client.delete(url).status_code, 500)

    def test_suffix_alias_matches_the_plain_route_status(self):
        """The alias is an alias: adding `.json` must not change the outcome.

        Catches the inverse failure too -- a handler that accepts `format` but
        branches on it would diverge here.
        """
        pairs = (
            ('/api/v1/todos/bible/bookmarks/', '/api/v1/todos/bible/bookmarks.json'),
            ('/api/v1/todos/bible/notes/', '/api/v1/todos/bible/notes.json'),
            (
                '/api/v1/todos/bible/personal-records/stats/',
                '/api/v1/todos/bible/personal-records/stats.json',
            ),
        )
        for plain, suffixed in pairs:
            with self.subTest(plain=plain):
                self.assertEqual(
                    self.client.get(plain).status_code,
                    self.client.get(suffixed).status_code,
                )
