from __future__ import annotations

import json
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PlanApiHandler(BaseHTTPRequestHandler):
    fail_progress = False
    requests: list[str] = []

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        self.requests.append(self.path)
        if parsed.path == "/api/v1/todos/plan/":
            body = [{"plan_id": 17, "plan_name": "Plan"}]
        elif parsed.path == "/api/v1/todos/stats/progress/":
            if self.fail_progress:
                self._reply(200, {"success": False, "error": "unusable"})
                return
            body = {"success": True, "end_date": "2026-09-30"}
        elif parsed.path == "/api/v1/todos/schedules/month/":
            if query.get("month") == ["9"]:
                body = [{"id": 91, "plan": 17, "book": "창세기", "start_chapter": 1}]
            else:
                body = []
        elif parsed.path == "/api/v1/todos/detail/":
            if query.get("book") != ["gen"]:
                self._reply(400, {"error": "book code required"})
                return
            body = {"plan_id": 17, "plan_detail": [{"schedule_id": 91}]}
        elif parsed.path == "/api/v1/todos/schedules/today/":
            body = {"success": True, "schedules": []}
        elif parsed.path == "/api/v1/todos/next-position/":
            body = {"success": True, "status": "nearest", "schedule_id": 91, "month": 9, "date": "2026-09-30"}
        else:
            self._reply(404, {})
            return
        self._reply(200, body)

    def _reply(self, status: int, body: object) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        return


class LivePlanSmokeTest(unittest.TestCase):
    def setUp(self) -> None:
        PlanApiHandler.fail_progress = False
        PlanApiHandler.requests = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), PlanApiHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()

    def run_checker(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check_live_plans.py"), self.base_url],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_reads_every_expected_route_and_accepts_empty_today(self) -> None:
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        paths = [urlparse(path).path for path in PlanApiHandler.requests]
        self.assertEqual(paths, [
            "/api/v1/todos/plan/",
            "/api/v1/todos/stats/progress/",
            "/api/v1/todos/schedules/month/",
            "/api/v1/todos/detail/",
            "/api/v1/todos/schedules/today/",
            "/api/v1/todos/next-position/",
            "/api/v1/todos/schedules/month/",
        ])

    def test_fails_closed_when_advertised_plan_progress_reports_failure(self) -> None:
        PlanApiHandler.fail_progress = True
        result = self.run_checker()
        self.assertEqual(result.returncode, 1)
        self.assertIn("success=false", result.stderr)


if __name__ == "__main__":
    unittest.main()
