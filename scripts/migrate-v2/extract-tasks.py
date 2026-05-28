#!/usr/bin/env python3
"""
extract-tasks.py — 슬라이스 플랜의 작업 항목을 catalog.json 으로 변환.

각 11-*.md 의 작업 표 (`| ID | 작업 | DoD |`) 를 파싱.
ID 패턴: `F-N`, `A-N`, `M-N`, `R-N`, `P-N`, `PR-N`, `H-N`, `CA-N`, `S-N`, `PF-N`, `AN-N`, `D-N`, `PW-N`, `AD-N`, `C-N`.

Output: scripts/migrate-v2/catalog.json
구조:
{
  "version": "1",
  "milestones": [{"title": "...", "description": "..."}],
  "issues": [
    {
      "id": "F-1",
      "title": "[FOUND] ...",
      "milestone": "v2/FOUND — Foundation 복구",
      "labels": ["slice:FOUND", "P0", "type:meta"],
      "body": "..."
    }
  ]
}
"""

import json
import re
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent.parent / "docs" / "migration-v2"

SLICE_META = {
    "FOUND":    {"prefix": "F",  "milestone": "v2/FOUND — Foundation 복구",          "priority": "P0"},
    "AUTH":     {"prefix": "A",  "milestone": "v2/AUTH — 인증 시스템",                "priority": "P1"},
    "MIGRATE":  {"prefix": "M",  "milestone": "v2/MIGRATE — 데이터 마이그레이션 v2",  "priority": "P0"},
    "DESIGN":   {"prefix": "D",  "milestone": "v2/DESIGN — 디자인 검증",              "priority": "P1"},
    "PWA":      {"prefix": "PW", "milestone": "v2/PWA — PWA+FCM",                     "priority": "P2"},
    "READER":   {"prefix": "R",  "milestone": "v2/READER — 성경 뷰어",                "priority": "P0"},
    "PLAN":     {"prefix": "P",  "milestone": "v2/PLAN — 통독 플랜·일정",             "priority": "P1"},
    "PROGRESS": {"prefix": "PR", "milestone": "v2/PROGRESS — 진도 추적",              "priority": "P1"},
    "HASENA":   {"prefix": "H",  "milestone": "v2/HASENA — 하세나",                   "priority": "P2"},
    "CATCHUP":  {"prefix": "CA", "milestone": "v2/CATCHUP — 캐치업",                  "priority": "P2"},
    "PROFILE":  {"prefix": "PF", "milestone": "v2/PROFILE — 프로필·업적·잔디",         "priority": "P2"},
    "SOCIAL":   {"prefix": "S",  "milestone": "v2/SOCIAL — 친구·스코어보드",          "priority": "P2"},
    "ANNOTATE": {"prefix": "AN", "milestone": "v2/ANNOTATE — 북마크·하이라이트·노트", "priority": "P1"},
    "ADMIN":    {"prefix": "AD", "milestone": "v2/ADMIN — 관리자 (별도 컷오버)",      "priority": "P3"},
    "CUTOVER":  {"prefix": "C",  "milestone": "v2/CUTOVER — 실 컷오버",               "priority": "P0"},
}

# 행 패턴: | F-1 | 작업 | 파일 | DoD | (4-col) 또는 | F-1 | 작업 | DoD | (3-col)
# **F-1** 또는 F-1 모두 허용. 마지막 컬럼은 항상 DoD 로 간주.
ROW_RE = re.compile(r"^\|\s*\*{0,2}([A-Z]{1,2})-(\d+[a-z]?)\*{0,2}\s*\|(.+?)\|\s*$")


def parse_slice(slice_name: str, prefix: str, file_path: Path):
    """파일에서 작업 표 행을 추출."""
    issues = []
    if not file_path.exists():
        print(f"  ⚠️  missing: {file_path}", file=sys.stderr)
        return issues

    content = file_path.read_text()
    for line in content.split("\n"):
        m = ROW_RE.match(line)
        if not m:
            continue
        row_prefix, num, rest = m.groups()
        if row_prefix != prefix:
            continue
        # rest 를 '|' 로 split. 마지막은 DoD, 첫째는 작업.
        cols = [c.strip() for c in rest.split("|")]
        work = cols[0] if cols else ""
        dod = cols[-1] if len(cols) > 1 else ""
        task_id = f"{row_prefix}-{num}"
        title = f"[{slice_name}] {work[:80]}"
        body = (
            f"## 슬라이스 / 작업\n"
            f"**슬라이스**: `slice:{slice_name}`  \n"
            f"**플랜**: docs/migration-v2/11-{slice_name}.md  \n"
            f"**작업 ID**: `{task_id}`\n\n"
            f"## 작업 내용\n{work}\n\n"
            f"## DoD (Definition of Done)\n"
            f"- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)\n"
            f"- [ ] **EVIDENCE** — `.sisyphus/evidence/{slice_name}-{task_id}.{{txt,png,json}}`\n"
            f"- [ ] **REPRODUCE** — 재현 명령 1줄\n"
            f"- [ ] **ASSERTION** — {dod}\n\n"
            f"## 차단 (Must NOT)\n"
            f"- 무관 파일 수정 금지\n"
            f"- placeholder 텍스트 production 포함 금지\n"
            f"- 인증 우회 스크린샷 통과 처리 금지\n"
            f"- `as unknown as X` PR 명시 승인 없이 사용 금지\n"
        )
        issues.append({
            "id": task_id,
            "title": title,
            "body": body,
        })
    return issues


def main():
    catalog = {
        "version": "1",
        "generated_at": "2026-05-28",
        "milestones": [],
        "issues": []
    }

    # Milestones
    for slice_name, meta in SLICE_META.items():
        catalog["milestones"].append({
            "title": meta["milestone"],
            "description": f"슬라이스 {slice_name} — 자세히는 docs/migration-v2/11-{slice_name}.md",
        })

    # Issues
    for slice_name, meta in SLICE_META.items():
        file_path = DOCS / f"11-{slice_name}.md"
        slice_issues = parse_slice(slice_name, meta["prefix"], file_path)
        for issue in slice_issues:
            issue["milestone"] = meta["milestone"]
            issue["labels"] = [
                f"slice:{slice_name}",
                meta["priority"],
                "state:ready",
            ]
        catalog["issues"].extend(slice_issues)
        print(f"  {slice_name}: {len(slice_issues)} issues", file=sys.stderr)

    # Output
    out = Path(__file__).resolve().parent / "catalog.json"
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print(f"\n총 milestone: {len(catalog['milestones'])}")
    print(f"총 issue: {len(catalog['issues'])}")
    print(f"저장: {out}")


if __name__ == "__main__":
    main()
