from __future__ import annotations

import json
import os
import subprocess
import tempfile
import threading
import time
import unittest
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar


class ProbeHandler(BaseHTTPRequestHandler):
    health_status: ClassVar[int] = 200
    deliveries: ClassVar[list[dict[str, str | list[str]]]] = []

    def do_GET(self) -> None:
        if self.path == "/health/":
            body = {"status": "ok" if self.health_status == 200 else "degraded"}
            self._respond(self.health_status, json.dumps(body))
            return
        if self.path in {"/ready/", "/api/health"}:
            self._respond(200, '{"status":"ok"}')
            return
        if self.path in {"/loki-ready", "/alloy-ready"}:
            self._respond(200, "ready")
            return
        self._respond(404, "not found")

    def do_POST(self) -> None:
        content_length = int(self.headers["Content-Length"])
        payload = json.loads(self.rfile.read(content_length))
        self.deliveries.append(payload)
        self._respond(200, '{"id":"email-canary-receipt"}')

    def log_message(self, format: str, *args: str) -> None:
        return

    def _respond(self, status: int, body: str) -> None:
        encoded = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


@contextmanager
def probe_server() -> Iterator[str]:
    ProbeHandler.health_status = 200
    ProbeHandler.deliveries = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), ProbeHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


class OpsAlertProbeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]
        self.script = self.root / "ops" / "probes" / "run.sh"

    def _run_probe(
        self,
        base_url: str,
        marker: Path,
        state: Path,
        *arguments: str,
        extra_environment: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        env = {
            **os.environ,
            "DJANGO_HEALTH_URL": f"{base_url}/health/",
            "DJANGO_READY_URL": f"{base_url}/ready/",
            "FRONTEND_HEALTH_URL": f"{base_url}/api/health",
            "LOKI_READY_URL": f"{base_url}/loki-ready",
            "ALLOY_READY_URL": f"{base_url}/alloy-ready",
            "BACKUP_RECEIPT_PATH": str(marker),
            "BACKUP_MAX_AGE_SECONDS": "3600",
            "ALERT_API_URL": f"{base_url}/emails",
            "RESEND_API_KEY": "test-api-key",
            "OPS_ALERT_EMAIL": "operator@example.test",
            "OPS_ALERT_FROM": "alerts@example.test",
            "ALERT_STATE_PATH": str(state),
            "LOKI_DATA_PATH": str(marker.parent),
            "DISK_MIN_FREE_PERCENT": "1",
        }
        env.update(extra_environment or {})
        return subprocess.run(
            ["bash", str(self.script), *arguments],
            cwd=self.root,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_canary_delivers_a_real_alert_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, probe_server() as base_url:
            temp = Path(temp_dir)
            backup = temp / "backup.sql.gz"
            backup.write_bytes(b"backup")
            marker = temp / "backup-success.json"
            marker.write_text(
                json.dumps(
                    {
                        "completed_at_epoch": int(time.time()),
                        "path": str(backup),
                        "size_bytes": backup.stat().st_size,
                    }
                ),
                encoding="utf-8",
            )

            result = self._run_probe(base_url, marker, temp / "state", "--canary")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("email-canary-receipt", result.stdout)
            self.assertEqual(len(ProbeHandler.deliveries), 1)
            self.assertIn("[CANARY]", str(ProbeHandler.deliveries[0]["subject"]))

    def test_failed_health_probe_delivers_an_alert(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, probe_server() as base_url:
            temp = Path(temp_dir)
            marker = temp / "backup-success.json"
            backup = temp / "backup.sql.gz"
            backup.write_bytes(b"backup")
            marker.write_text(
                json.dumps(
                    {
                        "completed_at_epoch": int(time.time()),
                        "path": str(backup),
                        "size_bytes": backup.stat().st_size,
                    }
                ),
                encoding="utf-8",
            )
            ProbeHandler.health_status = 503

            result = self._run_probe(base_url, marker, temp / "state")

            self.assertEqual(result.returncode, 1)
            self.assertEqual(len(ProbeHandler.deliveries), 1)
            self.assertIn("django_health", str(ProbeHandler.deliveries[0]["html"]))

    def test_stale_backup_receipt_delivers_an_alert(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, probe_server() as base_url:
            temp = Path(temp_dir)
            backup = temp / "backup.sql.gz"
            backup.write_bytes(b"backup")
            marker = temp / "backup-success.json"
            marker.write_text(
                json.dumps(
                    {
                        "completed_at_epoch": 1,
                        "path": str(backup),
                        "size_bytes": backup.stat().st_size,
                    }
                ),
                encoding="utf-8",
            )

            result = self._run_probe(base_url, marker, temp / "state")

            self.assertEqual(result.returncode, 1)
            self.assertEqual(len(ProbeHandler.deliveries), 1)
            self.assertIn("backup", str(ProbeHandler.deliveries[0]["html"]))

    def test_low_log_disk_space_delivers_an_alert(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir, probe_server() as base_url:
            temp = Path(temp_dir)
            backup = temp / "backup.sql.gz"
            backup.write_bytes(b"backup")
            marker = temp / "backup-success.json"
            marker.write_text(
                json.dumps(
                    {
                        "completed_at_epoch": int(time.time()),
                        "path": str(backup),
                        "size_bytes": backup.stat().st_size,
                    }
                ),
                encoding="utf-8",
            )

            result = self._run_probe(
                base_url,
                marker,
                temp / "state",
                extra_environment={"DISK_MIN_FREE_PERCENT": "101"},
            )

            self.assertEqual(result.returncode, 1)
            self.assertEqual(len(ProbeHandler.deliveries), 1)
            self.assertIn("log_disk", str(ProbeHandler.deliveries[0]["html"]))


if __name__ == "__main__":
    unittest.main()
