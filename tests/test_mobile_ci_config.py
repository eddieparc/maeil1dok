from __future__ import annotations

import json
import unittest
from pathlib import Path


class MobileCiConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        self.workflow = (repo_root / ".github" / "workflows" / "ci.yml").read_text(
            encoding="utf-8",
        )

    def test_mobile_ci_job_is_defined(self) -> None:
        self.assertIn("mobile-ci:", self.workflow)
        self.assertIn("needs.changes.outputs.mobile == 'true'", self.workflow)
        self.assertIn("working-directory: mobile", self.workflow)

    def test_mobile_ci_uses_npm_cache_keyed_to_lockfile(self) -> None:
        self.assertIn(
            "cache-dependency-path: mobile/package-lock.json",
            self.workflow,
        )

    def test_mobile_ci_installs_typechecks_and_tests(self) -> None:
        self.assertIn("npm ci", self.workflow)
        self.assertIn("npm run typecheck", self.workflow)
        self.assertIn("npm test", self.workflow)

    def test_mobile_paths_trigger_and_filter_are_present(self) -> None:
        self.assertIn("mobile/**", self.workflow)
        self.assertIn(
            "mobile: ${{ steps.filter.outputs.mobile }}",
            self.workflow,
        )

    def test_mobile_trigger_lives_outside_job_body(self) -> None:
        job_marker = "mobile-ci:"
        job_index = self.workflow.index(job_marker)
        top_level = self.workflow[:job_index]
        self.assertIn("mobile/**", top_level)

    def test_workflow_contract_test_triggers_ci(self) -> None:
        self.assertIn("tests/test_mobile_ci_config.py", self.workflow)

    def test_deployment_lane_runs_mobile_contract_test(self) -> None:
        self.assertIn("tests.test_mobile_ci_config", self.workflow)


if __name__ == "__main__":
    unittest.main()


class KakaoPluginKotlinVersionTest(unittest.TestCase):
    """The kakao-login plugin must not pin an ancient Kotlin into the prebuild.

    `@react-native-seoul/kakao-login` writes `android.kotlinVersion` during
    prebuild and defaults it to `1.5.10`. On Expo 54 / RN 0.81 that value makes
    `expo prebuild` produce an Android project that cannot build at all:

        Can't find KSP version for Kotlin version '1.5.10'

    Since `mobile/android/` is gitignored, nothing in the repo revealed this --
    a regenerated native project was simply broken. Pinning a supported version
    in the plugin props is what keeps prebuild reproducible.
    """

    def test_app_json_pins_a_supported_kotlin_version_for_the_kakao_plugin(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        config = json.loads((repo_root / "mobile" / "app.json").read_text(encoding="utf-8"))

        plugins = config["expo"]["plugins"]
        kakao = next(
            entry
            for entry in plugins
            if isinstance(entry, list) and entry[0] == "@react-native-seoul/kakao-login"
        )
        props = kakao[1]

        self.assertIn("kotlinVersion", props)
        major, minor = (int(part) for part in str(props["kotlinVersion"]).split(".")[:2])
        self.assertGreaterEqual((major, minor), (2, 0), props["kotlinVersion"])
