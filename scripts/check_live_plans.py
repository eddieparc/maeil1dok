#!/usr/bin/env python3
"""Fail-closed, read-only smoke check for every publicly advertised plan."""

from __future__ import annotations

import ast
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


TIMEOUT_SECONDS = 10


class CheckError(RuntimeError):
    pass


def get_json(base_url: str, path: str) -> tuple[int, Any]:
    request = Request(f"{base_url.rstrip('/')}{path}", headers={
        "Accept": "application/json",
        "User-Agent": "maeil1dok-deployment-smoke/1.0",
    })
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status = response.status
            payload = json.loads(response.read())
            return status, payload
    except HTTPError as error:
        try:
            payload = json.loads(error.read())
        except (json.JSONDecodeError, UnicodeDecodeError):
            payload = None
        return error.code, payload
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise CheckError(f"GET {path} failed: {error}") from error


def require_ok(base_url: str, path: str) -> Any:
    status, payload = get_json(base_url, path)
    if status != 200:
        raise CheckError(f"GET {path}: expected HTTP 200, got {status}")
    if isinstance(payload, dict) and payload.get("success") is False:
        raise CheckError(f"GET {path}: API reported success=false")
    return payload


def check(base_url: str) -> None:
    # Reuse the API's book-name contract without importing Django or maintaining
    # another 66-book table in the deployment runner.
    source = Path(__file__).resolve().parents[1] / "backend/todos/serializers.py"
    book_names = next(
        ast.literal_eval(node.value)
        for node in ast.parse(source.read_text(encoding="utf-8")).body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "BIBLE_BOOKS_KOR"
                for target in node.targets)
    )
    book_codes = {name: code for code, name in book_names.items()}
    plans = require_ok(base_url, "/api/v1/todos/plan/")
    if not isinstance(plans, list) or not plans:
        raise CheckError("plan collection must be a non-empty array")
    seen: set[int] = set()
    for plan in plans:
        if not isinstance(plan, dict):
            raise CheckError("plan collection contains a non-object")
        plan_id = plan.get("plan_id")
        if isinstance(plan_id, bool) or not isinstance(plan_id, int) or plan_id <= 0:
            raise CheckError("advertised plan has invalid plan_id")
        if plan_id in seen:
            raise CheckError(f"duplicate advertised plan_id {plan_id}")
        seen.add(plan_id)
        query = urlencode({"plan_id": plan_id})
        progress = require_ok(base_url, f"/api/v1/todos/stats/progress/?{query}")
        if not isinstance(progress, dict) or not progress.get("end_date"):
            raise CheckError(f"plan {plan_id} has no valid progress end_date")
        try:
            end_date = date.fromisoformat(progress["end_date"])
        except (TypeError, ValueError) as error:
            raise CheckError(f"plan {plan_id} has invalid progress end_date") from error

        # Select a month guaranteed to contain at least one schedule: the last
        # scheduled month. This remains valid for future and already-ended plans.
        month_query = urlencode({"plan_id": plan_id, "month": end_date.month, "year": end_date.year})
        month_rows = require_ok(base_url, f"/api/v1/todos/schedules/month/?{month_query}")
        if not isinstance(month_rows, list) or not month_rows:
            raise CheckError(f"plan {plan_id} end-date month has no schedules")
        if any(not isinstance(row, dict) or row.get("plan") != plan_id for row in month_rows):
            raise CheckError(f"plan {plan_id} month response contains mismatched plan IDs")
        first = month_rows[0]
        book = first.get("book")
        chapter = first.get("start_chapter")
        if not isinstance(book, str) or not book or not isinstance(chapter, int):
            raise CheckError(f"plan {plan_id} has malformed schedule identity")
        code = book if book in book_names else book_codes.get(book)
        if code is None:
            raise CheckError(f"plan {plan_id} has unknown schedule book")
        detail_query = urlencode({
            "plan_id": plan_id, "book": code, "chapter": chapter,
            "schedule_id": first.get("id"), "date": first.get("date", end_date.isoformat()),
        })
        detail = require_ok(base_url, f"/api/v1/todos/detail/?{detail_query}")
        if not isinstance(detail, dict) or str(detail.get("plan_id")) != str(plan_id):
            raise CheckError(f"plan {plan_id} detail response has invalid plan identity")
        detail_rows = detail.get("plan_detail")
        if not isinstance(detail_rows, list) or not detail_rows or any(
            not isinstance(row, dict) for row in detail_rows
        ):
            raise CheckError(f"plan {plan_id} detail response has invalid schedule rows")
        detail_ids = {
            row.get("schedule_id", row.get("id"))
            for row in detail_rows
            if isinstance(row.get("schedule_id", row.get("id")), (int, str))
        }
        if str(first.get("id")) not in {str(value) for value in detail_ids}:
            raise CheckError(f"plan {plan_id} detail omits the selected schedule")

        today_payload = require_ok(base_url, f"/api/v1/todos/schedules/today/?{query}")
        if not isinstance(today_payload, dict) or not isinstance(today_payload.get("schedules"), list):
            raise CheckError(f"plan {plan_id} today response has invalid shape")
        today_rows = today_payload["schedules"]
        if any(
            not isinstance(row, dict) or row.get("plan_id", plan_id) != plan_id
            for row in today_rows
        ):
            raise CheckError(f"plan {plan_id} today response has invalid schedule identity")
        next_position = require_ok(base_url, f"/api/v1/todos/next-position/?{query}")
        if not isinstance(next_position, dict):
            raise CheckError(f"plan {plan_id} next-position response is not an object")
        if next_position.get("success") is not True:
            raise CheckError(f"plan {plan_id} next-position response reported failure")
        schedule_id = next_position.get("schedule_id")
        if schedule_id is not None:
            target_date = next_position.get("date")
            target_month = next_position.get("month")
            if not isinstance(target_date, str) or not isinstance(target_month, int):
                raise CheckError(f"plan {plan_id} next-position has malformed date")
            status, next_month = get_json(
                base_url,
                f"/api/v1/todos/schedules/month/?{urlencode({'plan_id': plan_id, 'month': target_month, 'year': target_date[:4]})}",
            )
            if status != 200 or not isinstance(next_month, list) or not any(
                row.get("id") == schedule_id and row.get("plan") == plan_id
                for row in next_month if isinstance(row, dict)
            ):
                raise CheckError(f"plan {plan_id} next-position references unknown schedule")


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} BASE_URL", file=sys.stderr)
        return 2
    try:
        check(sys.argv[1])
    except CheckError as error:
        print(f"Live plan check failed: {error}", file=sys.stderr)
        return 1
    print("Live plan read smoke check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
