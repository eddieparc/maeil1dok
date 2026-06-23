from __future__ import annotations

import tomllib
import unittest
from pathlib import Path


class RailwayConfigTest(unittest.TestCase):
    def test_celery_beat_service_runs_worker_with_embedded_beat(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        config = tomllib.loads((repo_root / "railway" / "backend.beat.toml").read_text())

        start_command = config["deploy"]["startCommand"]

        self.assertIn("celery -A config worker", start_command)
        self.assertTrue(" --beat" in start_command or " -B" in start_command)
