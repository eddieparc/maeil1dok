#!/usr/bin/env python3
"""ulw-plan 아티팩트(.omo/plans/auth-session-ssot-migration.md)의 구조 검증기.

ulw-plan 아티팩트는 사람이 읽는 문서가 아니라 **실행기가 파싱하는 계약**이다.
worker 세션은 인터뷰 없이 이 파일만 보고 작업하므로, 아래가 깨지면 실행이 깨진다.

1. 작업 행 문법 — 구현 행은 `- [ ] N. <제목>`, 최종검증 행은 `- [ ] F<n>. <제목>`.
   컬럼 0에서 시작해야 한다. 산문 제목이나 일반 불릿은 작업의 대체물이 아니다.
2. 실행기 라우팅 — 모든 구현 행은 중첩된 `Recommended task executor category:` 를 갖는다.
3. 결정 완결성 — 모든 구현 행은 참조/수용기준/QA/커밋 4종 필드를 갖는다.
   비워 둔 필드는 실행 시점에 반드시 판단 요구로 돌아온다.
4. 번호 연속성 — 구현 행 번호가 1부터 빠짐없이 이어진다.
5. 필수 절 존재.

exit 0 + "ULW-PLAN STRUCTURE OK" 가 GREEN.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / ".omo" / "plans" / "auth-session-ssot-migration.md"

REQUIRED_SECTIONS = (
    "## Todos",
    "## Final verification wave",
)

# 컬럼 0 고정. 앞 공백이 있으면 중첩 불릿이므로 작업 행이 아니다.
IMPL_ROW = re.compile(r"^- \[ \] (?P<num>\d+)\. (?P<title>\S.*)$")
FINAL_ROW = re.compile(r"^- \[ \] F(?P<num>\d+)\. (?P<title>\S.*)$")
ANY_TASKISH = re.compile(r"^- \[ \] (?P<rest>.*)$")

# 각 구현 행이 반드시 갖춰야 하는 중첩 필드.
# 필드명 뒤에 괄호 주석을 붙이는 표기(`- QA (사람 수행): ...`)도 같은 필드로 인정한다.
# 실제로 이 표기를 세 번 반복해서 쓰게 됐으므로, 문서를 규칙에 맞추는 대신 규칙이 표기를 받아들인다.
# 느슨해지는 것은 표기뿐이며 "필드가 있고 값이 비어 있지 않다"는 검사는 그대로다.
REQUIRED_FIELDS = (
    "Recommended task executor category",
    "References",
    "Acceptance",
    "QA",
    "Commit",
)


def field_pattern(name: str) -> re.Pattern[str]:
    """`- Name:` 과 `- Name (주석):` 을 모두 매칭하고 값 부분을 캡처한다."""
    return re.compile(
        rf"^\s*-\s*{re.escape(name)}\s*(?:\([^)]*\))?\s*:\s*(?P<value>.*)$"
    )


def fail(problems: list[str]) -> int:
    print("ULW-PLAN STRUCTURE FAILED\n")
    for p in problems:
        print(f"  - {p}")
    print(f"\n{len(problems)} problem(s).")
    return 1


def block_for(lines: list[str], start: int) -> list[str]:
    """작업 행 바로 다음부터 다음 컬럼0 작업 행/헤딩 직전까지의 중첩 블록."""
    body: list[str] = []
    for line in lines[start + 1:]:
        if ANY_TASKISH.match(line) or line.startswith("#"):
            break
        body.append(line)
    return body


# 주의: `[^`]*` 를 탐욕적으로 두면 심볼 목록이 아니라 명령 뒤쪽의 마지막 따옴표 그룹
# (`'!node_modules'` 등)을 캡처해 아무것도 잡지 못한다. 반드시 비탐욕(`*?`)이어야 한다.
RG_ZERO = re.compile(r"`rg[^`]*?'([^']+)'[^`]*`[^.]{0,40}결과 \*\*?0건")
RETAIN_WORDS = ("존치", "의도적으로 남", "남아 있는지", "삭제 대상이 아니")


def check_absence_vs_retention(text: str) -> list[str]:
    """'심볼 X 가 0건이어야 한다'와 '심볼 X 를 의도적으로 존치한다'가 공존하는지 본다.

    이 모순은 네 번의 리뷰 웨이브에서 연속으로 발견됐다. 사람이 매번 잡는 대신
    기계가 잡는다. 오탐을 피하려고 조건을 좁게 잡았다 — 같은 심볼이
    'rg ... 결과 0건' 요구와 존치 선언에 동시에 등장할 때만 신고한다.
    """
    problems: list[str] = []
    zero_symbols: set[str] = set()
    for alternation in RG_ZERO.findall(text):
        for sym in alternation.split("|"):
            sym = sym.strip()
            # 경로 패턴이나 너무 짧은 토큰은 심볼로 보지 않는다.
            if len(sym) >= 4 and "/" not in sym:
                zero_symbols.add(sym)

    for sym in sorted(zero_symbols):
        for line in text.split("\n"):
            if sym in line and any(w in line for w in RETAIN_WORDS):
                problems.append(
                    f"모순: '{sym}' 은 rg 결과 0건이 요구되는데 같은 문서가 존치를 선언함 "
                    f"— '{line.strip()[:90]}'"
                )
                break
    return problems


def main() -> int:
    if not PLAN.exists():
        return fail([f"ulw-plan 아티팩트가 존재하지 않음: {PLAN.relative_to(REPO)}"])

    text = PLAN.read_text(encoding="utf-8")
    lines = text.split("\n")
    problems: list[str] = []

    for section in REQUIRED_SECTIONS:
        if section not in text:
            problems.append(f"필수 절 누락: '{section}'")

    impl: list[tuple[int, str, str]] = []   # (line_no, num, title)
    final: list[tuple[int, str, str]] = []

    for idx, line in enumerate(lines):
        m = FINAL_ROW.match(line)
        if m:
            final.append((idx, m.group("num"), m.group("title")))
            continue
        m = IMPL_ROW.match(line)
        if m:
            impl.append((idx, m.group("num"), m.group("title")))
            continue
        # 작업처럼 보이지만 문법을 못 맞춘 행을 잡는다.
        m = ANY_TASKISH.match(line)
        if m:
            problems.append(
                f"line {idx + 1}: 작업 행 문법 불일치 — '- [ ] {m.group('rest')[:60]}' "
                f"(구현은 '- [ ] N. 제목', 최종검증은 '- [ ] F<n>. 제목')"
            )

    if not impl:
        problems.append("구현 작업 행이 하나도 없음")
    if not final:
        problems.append("최종검증 작업 행(F<n>)이 하나도 없음")

    # 번호 연속성
    nums = [int(n) for _, n, _ in impl]
    expected = list(range(1, len(nums) + 1))
    if nums != expected:
        problems.append(f"구현 행 번호가 1..N 연속이 아님: {nums}")

    fnums = [int(n) for _, n, _ in final]
    if fnums != list(range(1, len(fnums) + 1)):
        problems.append(f"최종검증 행 번호가 1..N 연속이 아님: {fnums}")

    # 각 구현 행의 필수 중첩 필드
    for line_no, num, title in impl:
        body_lines = block_for(lines, line_no)
        for field in REQUIRED_FIELDS:
            pattern = field_pattern(field)
            matches = [m for m in (pattern.match(line) for line in body_lines) if m]
            if not matches:
                problems.append(f"작업 {num} ('{title[:40]}'): 필수 필드 누락 — '{field}'")
                continue
            # 같은 필드가 여러 번 나오면(보강 등) 하나라도 값이 있으면 통과시킨다.
            if not any(
                m.group("value").strip() not in {"", "TBD", "미정", "-"} for m in matches
            ):
                problems.append(f"작업 {num} ('{title[:40]}'): 필드 '{field}' 값이 비어 있음")

    # NOTE: 여기서 '요구-부재 vs 의도적 존치' 교차 모순을 기계로 잡으려 했으나
    # 라인 단위 휴리스틱이 정상 문서에서 오탐을 냈다("A·B·C는 사라져야 하고 D·E는 존치" 같은
    # 한 문장 안에 두 규칙이 공존하는 경우를 구분하지 못함). 노이즈를 내는 게이트는
    # 없는 것보다 나쁘므로 활성화하지 않는다. 이 부류는 리뷰 프롬프트에서
    # '거울 짝 대조'를 명시적으로 요구하는 방식이 실제로 훨씬 효과적이었다(한 웨이브에서 16건 적발).
    # 함수는 참고용으로 남겨두되 판정에 쓰지 않는다.
    _ = check_absence_vs_retention

    if problems:
        return fail(problems)

    print(f"implementation tasks: {len(impl)} (1..{len(impl)}, contiguous)")
    print(f"final verification tasks: {len(final)}")
    print("every implementation row carries executor category, references, acceptance, QA, commit")
    print("ULW-PLAN STRUCTURE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
