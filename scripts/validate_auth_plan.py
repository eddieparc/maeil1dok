#!/usr/bin/env python3
"""인증/세션 재설계 계획서(.omo/plans/auth-session-redesign.md)의 기계 검증기.

계획서는 사람이 읽는 문서지만, 두 가지는 기계가 검증할 수 있고 검증해야 한다.

1. 완결성 — 모든 Phase가 실행에 필요한 5개 필드를 빠짐없이 갖는다.
   "나중에 정하자"로 비워 둔 필드는 실행 시점에 반드시 사고로 돌아온다.
2. 실재성 — "걷어낼 것" 목록의 모든 경로/심볼이 현재 리포에 실제로 존재한다.
   존재하지 않는 대상을 지우라고 적힌 계획서는 이미 현실과 어긋나 있다는 뜻이다.

exit 0 + "ALL PHASES COMPLETE" 가 GREEN.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / ".omo" / "plans" / "auth-session-redesign.md"

REQUIRED_PHASE_FIELDS = (
    "배포 대상",
    "호환 shim",
    "은퇴 조건",
    "롤백",
    "go/no-go 신호",
)

PHASE_HEADING = re.compile(r"^### Phase\s+(\S+)\s*[—-]\s*(.+)$", re.M)
FIELD_LINE = re.compile(r"^-\s+\*\*(?P<name>[^*]+?)\*\*\s*:", re.M)
DELETE_BLOCK = re.compile(r"```delete-list\n(?P<body>.*?)```", re.S)


def fail(problems: list[str]) -> int:
    print("PLAN VALIDATION FAILED\n")
    for p in problems:
        print(f"  - {p}")
    print(f"\n{len(problems)} problem(s).")
    return 1


def split_phases(text: str) -> list[tuple[str, str, str]]:
    """(phase id, title, body) 목록. body 는 다음 Phase 제목 직전까지."""
    matches = list(PHASE_HEADING.finditer(text))
    phases = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        phases.append((m.group(1), m.group(2).strip(), text[m.end():end]))
    return phases


def check_phase_fields(phases: list[tuple[str, str, str]]) -> list[str]:
    problems: list[str] = []
    for pid, title, body in phases:
        present = {FIELD_LINE.match(line).group("name").strip()
                   for line in body.splitlines() if FIELD_LINE.match(line)}
        for required in REQUIRED_PHASE_FIELDS:
            if not any(required in name for name in present):
                problems.append(f"Phase {pid} ({title}): 필수 필드 누락 — '{required}'")
        for line in body.splitlines():
            m = FIELD_LINE.match(line)
            if not m:
                continue
            value = line.split(":", 1)[1].strip()
            if not value or value in {"TBD", "미정", "-"}:
                problems.append(
                    f"Phase {pid} ({title}): 필드 '{m.group('name').strip()}' 값이 비어 있음"
                )
    return problems


def check_delete_targets(text: str) -> list[str]:
    problems: list[str] = []
    blocks = DELETE_BLOCK.findall(text)
    if not blocks:
        return ["'걷어낼 것' 목록(```delete-list``` 블록)이 없음"]

    items = [
        line.split("#", 1)[0].strip()
        for block in blocks
        for line in block.splitlines()
        if line.split("#", 1)[0].strip()
    ]
    if not items:
        return ["delete-list 블록이 비어 있음"]

    for item in items:
        path_part, _, symbol = item.partition("::")
        target = REPO / path_part.strip()
        if not target.exists():
            problems.append(f"삭제 대상 경로가 실재하지 않음: {path_part.strip()}")
            continue
        symbol = symbol.strip()
        if not symbol:
            continue
        found = subprocess.run(
            ["rg", "--fixed-strings", "--quiet", symbol, str(target)],
            cwd=REPO,
            capture_output=True,
        )
        if found.returncode != 0:
            problems.append(
                f"삭제 대상 심볼을 파일에서 찾을 수 없음: {path_part.strip()} :: {symbol}"
            )
    return problems


def main() -> int:
    if not PLAN.exists():
        return fail([f"계획서가 존재하지 않음: {PLAN.relative_to(REPO)}"])

    text = PLAN.read_text(encoding="utf-8")
    phases = split_phases(text)

    problems: list[str] = []
    if not phases:
        problems.append("'### Phase N — 제목' 형식의 Phase 절이 하나도 없음")
    problems += check_phase_fields(phases)
    problems += check_delete_targets(text)

    if problems:
        return fail(problems)

    print(f"checked {len(phases)} phase(s), all required fields present")
    print("delete-list targets all exist in the repository")
    print("ALL PHASES COMPLETE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
