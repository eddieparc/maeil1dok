from __future__ import annotations

import unittest
from pathlib import Path


class BackendCiConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        self.workflow = (repo_root / ".github" / "workflows" / "ci.yml").read_text(
            encoding="utf-8",
        )

    def test_backend_ci_job_is_defined(self) -> None:
        self.assertIn("backend-ci:", self.workflow)
        self.assertIn("needs.changes.outputs.backend == 'true'", self.workflow)
        self.assertIn("working-directory: backend", self.workflow)

    def test_backend_test_command_includes_bible_cache(self) -> None:
        self.assertIn(
            "run: python manage.py test accounts todos tests bible_cache",
            self.workflow,
        )

    def test_stale_backend_test_command_is_absent(self) -> None:
        self.assertNotIn(
            "run: python manage.py test accounts todos tests\n",
            self.workflow,
        )

    def test_workflow_contract_test_triggers_push_ci(self) -> None:
        push_marker = "push:"
        pull_marker = "pull_request:"
        push_index = self.workflow.index(push_marker)
        pull_index = self.workflow.index(pull_marker)
        push_block = self.workflow[push_index:pull_index]
        self.assertIn("tests/test_backend_ci_config.py", push_block)

    def test_workflow_contract_test_triggers_pull_request_ci(self) -> None:
        pull_marker = "pull_request:"
        jobs_marker = "\njobs:"
        pull_index = self.workflow.index(pull_marker)
        jobs_index = self.workflow.index(jobs_marker)
        pull_block = self.workflow[pull_index:jobs_index]
        self.assertIn("tests/test_backend_ci_config.py", pull_block)

    def test_deployment_paths_filter_includes_contract_test(self) -> None:
        filter_marker = "deployment:"
        filter_index = self.workflow.index(filter_marker)
        jobs_after = self.workflow.index("\n  backend-ci:")
        deployment_block = self.workflow[filter_index:jobs_after]
        self.assertIn("tests/test_backend_ci_config.py", deployment_block)

    def test_deployment_lane_runs_backend_contract_test(self) -> None:
        self.assertIn("tests.test_backend_ci_config", self.workflow)

    def test_deploy_rebuilds_and_recreates_celery_services(self) -> None:
        compose = "docker compose -f docker-compose.oci.yml --env-file .env.oci"
        self.assertIn(
            f"{compose} build web celery-worker celery-beat frontend",
            self.workflow,
        )
        self.assertIn(
            f"{compose} up -d web celery-worker celery-beat frontend cloudflared",
            self.workflow,
        )

    def test_deploy_smoke_checks_backend_readiness(self) -> None:
        self.assertIn("https://api.maeil1dok.app/ready/", self.workflow)
        self.assertIn('[ "$ready" = "200" ]', self.workflow)


if __name__ == "__main__":
    unittest.main()
