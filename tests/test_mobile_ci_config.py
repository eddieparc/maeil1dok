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


class StoreBuildChannelTest(unittest.TestCase):
    """A store-bound build must carry an update channel.

    Measured 2026-08-29: the shipped iOS binary sends no `expo-channel-name`, so
    every update check returns

        HTTP 400 "channel-name": Required.

    No runtime version can fix that -- OTA is structurally impossible for such a
    binary. The cause is that `expo prebuild` does NOT inject a channel (EAS Build
    does), and the store binary was built locally from a prebuild and submitted by
    hand: `eas build:list` holds no 1.2.x production build at all.

    These assertions keep the EAS profiles able to supply the channel. They cannot
    prove a hand-built binary carried one -- that hazard is recorded in
    `docs/auth-migration-handoff.md` H1 and must stay there.
    """

    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        self.eas = json.loads((repo_root / "mobile" / "eas.json").read_text(encoding="utf-8"))

    def test_every_build_profile_declares_a_channel(self) -> None:
        for name, profile in self.eas["build"].items():
            with self.subTest(profile=name):
                channel = profile.get("channel")
                if channel is None and "extends" in profile:
                    channel = self.eas["build"][profile["extends"]].get("channel")
                self.assertIsNotNone(channel, f"build profile {name} must declare a channel")

    def test_production_profile_targets_the_production_channel(self) -> None:
        self.assertEqual(self.eas["build"]["production"]["channel"], "production")


class StoreArtifactVerifierTest(unittest.TestCase):
    """The channel check must be a reachable command, not a file nobody runs.

    The 2026-08-29 incident shipped a store binary with no update channel. The
    verifier exists to refuse exactly that, but a script that is not wired into
    `package.json` is one an operator never finds at the moment it matters -- the
    minutes before a submission.
    """

    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[1]

    def test_the_verifier_ships_with_the_mobile_app(self) -> None:
        self.assertTrue((self.repo_root / "mobile" / "scripts" / "verify-store-artifact.mjs").exists())

    def test_the_verifier_is_runnable_as_a_named_script(self) -> None:
        scripts = json.loads(
            (self.repo_root / "mobile" / "package.json").read_text(encoding="utf-8")
        )["scripts"]

        self.assertIn("verify:store", scripts)
        self.assertIn("verify-store-artifact.mjs", scripts["verify:store"])


class LocalBuildChannelGuardTest(unittest.TestCase):
    """The local build path must not be able to produce a channel-less binary silently.

    This is the path that actually shipped the broken binary. `scripts/build.sh`
    offers "빌드 환경 선택: 1) 클라우드(EAS Build) / 2) 로컬", and choosing local runs
    `expo prebuild --clean` followed by gradlew or Xcode. None of those three inject
    an update channel -- only EAS Build does -- so the resulting binary asks the
    update server for a manifest without `expo-channel-name` and is answered
    HTTP 400 forever.

    Documentation alone does not close this: `DEPLOYMENT_MOBILE.md` already described
    only the EAS path while the tool kept offering the local one right beside it.
    The check has to run where the mistake is made.
    """

    def setUp(self) -> None:
        self.script = (
            Path(__file__).resolve().parents[1] / "mobile" / "scripts" / "build.sh"
        ).read_text(encoding="utf-8")

    def test_the_local_build_path_verifies_the_update_channel(self) -> None:
        start = self.script.index("build_local()")
        end = self.script.index("\n}", start)
        body = self.script[start:end]

        self.assertIn("verify-store-artifact", body)

    def test_the_prebuild_step_verifies_the_update_channel(self) -> None:
        # prebuild is the earliest point the omission exists, and for iOS it is the
        # only one this script reaches: the local iOS path just opens Xcode.
        start = self.script.index("run_prebuild()")
        end = self.script.index("\n}", start)
        body = self.script[start:end]

        self.assertIn("verify-store-artifact", body)
