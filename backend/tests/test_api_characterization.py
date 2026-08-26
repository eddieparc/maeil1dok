import difflib
import json
import os

from django.test import TestCase, override_settings

from tests.api_characterization import (
    GOLDEN_PATH,
    capture_characterization,
    create_characterization_fixtures,
)


@override_settings(ROOT_URLCONF="config.test_urls")
class ApiCharacterizationGoldenTest(TestCase):
    maxDiff = None

    @classmethod
    def setUpTestData(cls):
        cls.owner, cls.non_owner, cls.fixture_ids = create_characterization_fixtures()

    def test_http_contract_matches_golden(self):
        actual = capture_characterization(
            self.owner,
            self.non_owner,
            self.fixture_ids,
        )
        rendered_actual = json.dumps(
            actual,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ) + "\n"

        if os.environ.get("UPDATE_CHARACTERIZATION_GOLDEN") == "1":
            GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
            GOLDEN_PATH.write_text(rendered_actual, encoding="utf-8")
            return

        expected = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
        if expected == actual:
            return

        rendered_expected = json.dumps(
            expected,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ) + "\n"
        diff = "".join(
            difflib.unified_diff(
                rendered_expected.splitlines(keepends=True),
                rendered_actual.splitlines(keepends=True),
                fromfile=str(GOLDEN_PATH),
                tofile="current HTTP characterization",
            )
        )
        self.fail(f"HTTP contract differs from the committed golden file:\n{diff}")
