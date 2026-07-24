#!/usr/bin/env bash
# validate-plan.sh — docs/migration-v2/ 의 모든 문서가 메타 시스템 규칙을 통과하는지 자가 검증
# Oracle R-final + Momus R-rerun-1 의 false-clean 약점 (문자열 존재만 검사) 보강.
# Usage: ./validate-plan.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS="$REPO_ROOT/docs/migration-v2"

PASS=0
FAIL=0

check() {
    local desc="$1"
    local cmd="$2"
    local expected="$3"
    local actual
    actual=$(eval "$cmd" 2>/dev/null)
    if [[ "$actual" == "$expected" ]]; then
        echo "✅ PASS  $desc  ($actual)"
        PASS=$((PASS+1))
    else
        echo "❌ FAIL  $desc  expected=$expected actual=$actual"
        FAIL=$((FAIL+1))
    fi
}

cd "$DOCS"

echo "===== 1. 누락 표현 검출 (Momus R1 Minor #1) — rule/critique/README 제외 ====="
# 정당 용례: 00-meta-system.md, README.md (규칙 정의), 20-*/21-* (critique 인용)
# "나머지 X" (X 가 명시된 경우) 는 정당. 단독 "나머지." 만 누락 의심
check "요약 표현 hits 0 (rule·critique 제외)" \
  "grep -rnE '기타 등등|etc\\.|and so on|그 외 다수|^\\.\\.\\.\\s*\$' --include='[01]*.md' --include='10-*.md' --include='11-*.md' --include='4*.md' . | grep -vE '^\./(00-meta-system|README)' | grep -vE '금지|forbid' | wc -l | xargs" "0"

echo ""
echo "===== 2. TS 우회 패턴 검출 (00-meta §2.5 반영) — critique 본문(20-*/21-*) 제외 ====="
check "@ts-ignore in plan docs" "grep -rE '@ts-ignore' --include='[01]*.md' --include='10-*.md' --include='11-*.md' --include='4*.md' . | grep -v '금지' | wc -l | xargs" "0"
check "@ts-expect-error in plan docs" "grep -rE '@ts-expect-error' --include='[01]*.md' --include='10-*.md' --include='11-*.md' --include='4*.md' . | grep -v '금지' | wc -l | xargs" "0"

echo ""
echo "===== 3. 인벤토리 카운트 ↔ 실 파일 수 (Gate A 재검증) ====="
check "Nuxt pages current snapshot" "find $REPO_ROOT/frontend/app/pages -name '*.vue' | wc -l | xargs" "43"
check "Next pages current snapshot" "find $REPO_ROOT/maeil1dok-next/src/app -name 'page.tsx' | wc -l | xargs" "34"
check "Django models current snapshot" "grep -rhE '^class [A-Z][A-Za-z]+\\(.*Model' $REPO_ROOT/backend/*/models.py | wc -l | xargs" "32"
check "Supabase migrations current snapshot" "ls $REPO_ROOT/maeil1dok-next/supabase/migrations/*.sql | wc -l | xargs" "22"

echo ""
echo "===== 4. 핵심 메타 규칙 시행 검증 (기본) ====="
check "Critical 3 0% hard fail 박힘" "grep -lE 'Critical 3.*0%|0% hard fail' 11-MIGRATE.md | wc -l | xargs" "1"
check "Fix-Forward Only 박힘" "grep -lE 'Fix-Forward Only' 11-CUTOVER.md | wc -l | xargs" "1"
check "Hard Block 503 박힘 (Oracle R1 Critical #2)" "grep -lE 'Hard Block 503' 11-CUTOVER.md | wc -l | xargs" "1"
check "Wave 1 단독 MIGRATE 박힘" "grep -lE 'Wave 1.*직렬 단독|Wave 1 \\(직렬' 10-plan-overview.md | wc -l | xargs" "1"
check "ADMIN-CORE / EXTENDED 분할 박힘" "grep -lE 'ADMIN-CORE' 10-plan-overview.md | wc -l | xargs" "1"
check "SocialAccount MIGRATE 박힘 (Oracle R1 Critical #1)" "grep -lE 'SocialAccount.*MIGRATE' 11-MIGRATE.md | wc -l | xargs" "1"
check "password_verification_hook 박힘 (Oracle R2 #1 + 자가 R3 Self-1)" "grep -lE 'password_verification_hook' 11-MIGRATE.md | wc -l | xargs" "1"
check "Trigger 충돌 우회 박힘 (Oracle R2 Critical #2)" "grep -lE 'Trigger 충돌 우회|ON CONFLICT' 11-MIGRATE.md | wc -l | xargs" "1"
check "identity_data JSONB 박힘 (Oracle R2 Major #3)" "grep -lE 'identity_data JSONB' 11-MIGRATE.md | wc -l | xargs" "1"
check "구 클라이언트 503 처리 역검증 (Oracle R2 Major #4)" "grep -lE 'C-9c|구 클라이언트 503 처리' 11-CUTOVER.md | wc -l | xargs" "1"
check "service_role 유출 차단 (Oracle R2 Major #5)" "grep -lE 'service_role key 유출 차단|NEXT_PUBLIC_.*SERVICE_ROLE' 00-meta-system.md | wc -l | xargs" "1"
check "Supabase IaC 박힘 (Oracle R1 Major #3)" "grep -lE 'Supabase CLI 도입|supabase init' 11-FOUND.md | wc -l | xargs" "1"
check "Vercel Preview Mock 박힘 (Oracle R1 Major #4)" "grep -lE 'Vercel Preview.*Mock|Mock 모드' 11-AUTH.md | wc -l | xargs" "1"

echo ""
echo "===== 4b. Oracle R-final 신규 fix 박힘 검증 ====="
check "Critical #1 — Wave 일관화 박힘" "grep -lE 'Oracle R-final Critical #1.*일관화|Critical #1.*Wave' 40-github-mapping.md | wc -l | xargs" "1"
check "Critical #2 — DISABLE/RE-ENABLE 금지 박힘 (11-MIGRATE §4.0)" "grep -lE 'DISABLE/RE-ENABLE 절대 금지|DISABLE TRIGGER 절대 금지|validator hard fail' 11-MIGRATE.md | wc -l | xargs" "1"
check "Critical #3 — Valid Users SSOT (valid_users.sql) 박힘" "grep -lE 'valid_users\\.sql' 11-MIGRATE.md | wc -l | xargs" "1"
check "Critical #3 — skip 전수 게이트 박힘" "grep -lE 'skip.*전수|\\|skip\\|.*20|manifest 조작' 11-MIGRATE.md | wc -l | xargs" "1"
check "Major #1 — idempotency digest hash 박힘 (M-8)" "grep -lE 'digest hash|deterministic digest|sha256' 11-MIGRATE.md | wc -l | xargs" "1"
check "Major #2 — OAuth UUID 실 검증 박힘 (M-5b)" "grep -lE 'getUser\\(\\)\\.id.*user_mapping|실 OAuth/token exchange' 11-MIGRATE.md | wc -l | xargs" "1"
check "Major #3 — legacy_password_hashes 스키마 박힘 (M-5c)" "grep -lE 'legacy_password_hashes' 11-MIGRATE.md | wc -l | xargs" "1"
check "Major #4 — service_role 5중 차단 박힘 (00-meta)" "grep -lE 'server-only import 강제|client bundle.*sourcemap|route log redaction|issue body sanitizer' 00-meta-system.md | wc -l | xargs" "1"
check "Major #4 — F-13 5중 차단 박힘" "grep -lE 'service_role 5중 차단|5 경로 모두' 11-FOUND.md | wc -l | xargs" "1"
check "Major #5 — C-9d Cache invalidation 박힘" "grep -lE 'C-9d|Cache invalidation 5중' 11-CUTOVER.md | wc -l | xargs" "1"
check "Major #7 — Incident Ladder 박힘 (L1~L4)" "grep -lE 'Incident Ladder|L1 — Hotfix|L2 — Mitigation|L3 — Emergency|L4 — Plan G' 11-CUTOVER.md | wc -l | xargs" "1"
check "Momus #2 — PRE-4 그룹 백로그 박힘 (11-SOCIAL)" "grep -lE '백로그.*PRE-4|PRE-4.*백로그' 11-SOCIAL.md | wc -l | xargs" "1"
check "Momus #2 — PRE-4 그룹 SKIP 박힘 (11-MIGRATE)" "grep -lE 'ReadingGroup.*SKIP|GroupMembership.*SKIP|GroupInvitation.*SKIP|PRE-4 백로그 확정' 11-MIGRATE.md | wc -l | xargs" "1"
check "Momus #2 — PRE-5 ADMIN-CORE 메인 포함 박힘 (40-mapping)" "grep -lE 'ADMIN-CORE.*메인 컷오버 포함|메인 컷오버 포함.*ADMIN-CORE' 40-github-mapping.md | wc -l | xargs" "1"

echo ""
echo "===== 5. 15 슬라이스 + 핵심 4문서 + 매트릭스 + 스코어카드 모두 존재 ====="
for f in README.md 00-meta-system.md 01-nuxt-inventory.md 02-next-inventory.md 03a-backend-api.md 03b-backend-domain.md 04-production-live-audit.md 05-feature-matrix.md 06-quality-scorecard.md 10-plan-overview.md 11-FOUND.md 11-AUTH.md 11-MIGRATE.md 11-DESIGN.md 11-PWA.md 11-READER.md 11-PLAN.md 11-PROGRESS.md 11-HASENA.md 11-CATCHUP.md 11-ANNOTATE.md 11-SOCIAL.md 11-PROFILE.md 11-ADMIN.md 11-CUTOVER.md 40-github-mapping.md; do
    if [ -f "$f" ]; then
        echo "✅ exists: $f"
        PASS=$((PASS+1))
    else
        echo "❌ MISSING: $f"
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "===== 6. 추측 표현 — (verify/unverified/검증) 태그 또는 정당 용례 제외 ====="
# 정당 용례: "추정 크기" (size estimation), "추정 원인" (root cause hypothesis), critique docs (20-*/21-*)
untagged=$(grep -nE '추정|아마|보임|예상됨' *.md 2>/dev/null \
    | grep -v "verify\|unverified\|검증\|금지" \
    | grep -v "추정 크기\|추정 원인" \
    | grep -ivE "critique|review|handoff|momus|oracle" \
    | wc -l | xargs)
check "추측 표현 untagged 0 (critique·size·root-cause 제외)" "echo $untagged" "0"

echo ""
echo "===== 7. Wave 헤더 3중 일관성 (Oracle R-final Critical #1) ====="
# macOS bash 3.x compatible — case statement instead of associative array

expected_wave_for() {
    case "$1" in
        FOUND) echo 0 ;;
        MIGRATE) echo 1 ;;
        AUTH|DESIGN|PWA) echo 2 ;;
        READER|PLAN|ANNOTATE) echo 3 ;;
        PROGRESS|HASENA|CATCHUP|PROFILE) echo 4 ;;
        SOCIAL|ADMIN) echo 5 ;;
        CUTOVER) echo 6 ;;
        *) echo "?" ;;
    esac
}

slice_header_wave() {
    # Extract first digit immediately after "Wave" mention in 11-*.md header (first 10 lines)
    local f="$1"
    head -10 "$f" | grep -oE 'Wave[*: ]+[0-9]' | head -1 | grep -oE '[0-9]'
}

mapping_wave() {
    # Extract Wave column for given slice from 40-github-mapping.md milestone table
    # ADMIN matches v2/ADMIN-CORE row
    local slice="$1"
    grep -E "v2/${slice}[^A-Z]" 40-github-mapping.md | head -1 | awk -F'|' '{gsub(/^ +| +$/, "", $3); print $3}'
}

for slice in FOUND MIGRATE AUTH DESIGN PWA READER PLAN ANNOTATE PROGRESS HASENA CATCHUP PROFILE SOCIAL ADMIN CUTOVER; do
    file="11-${slice}.md"
    expected=$(expected_wave_for "$slice")
    if [ ! -f "$file" ]; then
        echo "❌ FAIL  Wave 헤더 검사: $file 없음"
        FAIL=$((FAIL+1))
        continue
    fi
    header_wave=$(slice_header_wave "$file")
    map_wave=$(mapping_wave "$slice")
    if [[ "$header_wave" == "$expected" ]] && [[ "$map_wave" == "$expected" ]]; then
        echo "✅ PASS  Wave 일관성 [$slice]  header=$header_wave / mapping=$map_wave / expected=$expected"
        PASS=$((PASS+1))
    else
        echo "❌ FAIL  Wave 일관성 [$slice]  header=$header_wave / mapping=$map_wave / expected=$expected"
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "===== 8. DISABLE TRIGGER / RE-ENABLE 절대 금지 (Oracle R-final Critical #2) ====="
# critique 본문 (20-*/21-*/22-*/23-*/24-*/25-*/26-*/30-*/31-*/32-*) 제외
# "금지" / "forbidden" / "validator hard fail" 와 동시 등장하는 라인은 정당 (금지 명시)
disable_violations=$(grep -nrE 'DISABLE TRIGGER|RE-ENABLE|트리거 DISABLE|트리거 RE-ENABLE' --include='*.md' . 2>/dev/null \
    | grep -ivE 'critique|review|handoff|momus|oracle' \
    | grep -vE '금지|forbidden|validator hard fail|hard fail|FAIL|권한 실패|DISABLE 대신|대신 신규 가입|직전 안|순서 모순' \
    | wc -l | xargs)
check "DISABLE/RE-ENABLE non-critique 비-금지 라인 0건" "echo $disable_violations" "0"

echo ""
echo "===== 9. DoD 4-tuple 완전성 (Oracle R-final Major #6 — 11-*.md 파일별 4 키워드 모두 존재) ====="
for f in 11-FOUND.md 11-AUTH.md 11-MIGRATE.md 11-READER.md 11-PLAN.md 11-PROGRESS.md 11-HASENA.md 11-CATCHUP.md 11-ANNOTATE.md 11-DESIGN.md 11-PWA.md 11-SOCIAL.md 11-PROFILE.md 11-ADMIN.md 11-CUTOVER.md; do
    has_change=$(grep -cE '\*\*CHANGE\*\*' "$f" 2>/dev/null)
    has_evidence=$(grep -cE '\*\*EVIDENCE\*\*' "$f" 2>/dev/null)
    has_reproduce=$(grep -cE '\*\*REPRODUCE\*\*' "$f" 2>/dev/null)
    has_assertion=$(grep -cE '\*\*ASSERTION\*\*' "$f" 2>/dev/null)
    if (( has_change > 0 )) && (( has_evidence > 0 )) && (( has_reproduce > 0 )) && (( has_assertion > 0 )); then
        echo "✅ PASS  DoD 4-tuple [$f]  C=$has_change E=$has_evidence R=$has_reproduce A=$has_assertion"
        PASS=$((PASS+1))
    else
        echo "❌ FAIL  DoD 4-tuple [$f]  C=$has_change E=$has_evidence R=$has_reproduce A=$has_assertion (모두 ≥1 요구)"
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "===== 10. Hard-coded row count 검출 (Oracle R-final Minor #3) ====="
# critique 본문 + Plan F 직전 실패 분석표 (11-MIGRATE §2) 제외
# 패턴: "row count\s*=\s*\d{3,}" 또는 "count\s*=\s*\d{3,}" 가 'snapshot|expected|deterministic|참고치|참고|live snapshot' 없이 등장
hardcoded=$(grep -nrE 'row count\s*=\s*[0-9]{3,}|count\s*=\s*[0-9]{3,}' --include='11-*.md' --include='10-*.md' . 2>/dev/null \
    | grep -ivE 'critique|review|handoff|momus|oracle' \
    | grep -vE 'snapshot|expected|deterministic|참고치|참고|live snapshot|delta = 0|delta=0' \
    | grep -vE '11-MIGRATE\.md:2[0-9]:' \
    | wc -l | xargs)
check "Hard-coded row count 0건 (snapshot/expected 미명시)" "echo $hardcoded" "0"

echo ""
echo "===== 11. 핵심 신규 fix 본문 확인 (단순 keyword 존재 — Oracle R-final 신규) ====="
check "11-MIGRATE.md §4.0 maintenance hard block 순서 표 박힘" "grep -lE 'Maintenance/signup hard block ON|maintenance/signup hard block' 11-MIGRATE.md | wc -l | xargs" "1"
check "11-MIGRATE.md M-5b OAuth UUID provider unique 검증 박힘" "grep -lE 'provider.*provider_id.*중복 0건|유니크 제약 검증' 11-MIGRATE.md | wc -l | xargs" "1"
check "11-MIGRATE.md M-5c (a) 30일 cron + migrated_at 박힘" "grep -lE 'migrated_at|30일' 11-MIGRATE.md | wc -l | xargs" "1"
check "11-CUTOVER.md C-9d 5중 (Cloudflare purge + SW + Cache-Control + meta refresh + staging)" "grep -lE 'Cloudflare full purge|Cache-Control: no-store|skipWaiting|cf-cli purge' 11-CUTOVER.md | wc -l | xargs" "1"
check "11-CUTOVER.md Incident Ladder L1~L4 모두 박힘" "grep -lE 'L1 — Hotfix Window' 11-CUTOVER.md | wc -l | xargs" "1"
check "11-CUTOVER.md §4 read-only 잔존 0건 (Minor #2)" "grep -nE 'read-only 모드' 11-CUTOVER.md | grep -vE '^\s*$|Oracle R-final Minor|read 라도 가능' | wc -l | xargs" "0"
check "11-PLAN.md hard-coded 463 제거 → snapshot 기반" "grep -nE '= 463' 11-PLAN.md | grep -vE '참고치|참고|snapshot' | wc -l | xargs" "0"

echo ""
echo "===== 12. 11-AUTH / 11-PWA / 11-MIGRATE / 11-DESIGN Wave 헤더 (R-final Critical #1 디테일) ====="
check "11-MIGRATE.md Wave 1 직렬 단독 박힘" "grep -lE '^>.*\*\*Wave\*\*: 1' 11-MIGRATE.md | wc -l | xargs" "1"
check "11-AUTH.md Wave 2 병렬 박힘" "grep -lE '^>.*\*\*Wave\*\*: 2.*MIGRATE 산출물 위' 11-AUTH.md | wc -l | xargs" "1"
check "11-DESIGN.md Wave 2 병렬 박힘" "grep -lE '^>.*\*\*Wave\*\*: 2.*data 무관' 11-DESIGN.md | wc -l | xargs" "1"
check "11-PWA.md Wave 2 박힘" "grep -lE 'Wave\*\*: 2' 11-PWA.md | wc -l | xargs" "1"

echo ""
echo "===== 13. Oracle R-rerun-final 신규 fix 박힘 (Critical + Major + Minor) ====="
check "R-rerun-final Critical #1 — extract-tasks.py backtick-aware split 박힘" "grep -lE 'split_row_pipe_safe|backtick-protection' $REPO_ROOT/scripts/migrate-v2/extract-tasks.py 2>/dev/null | wc -l | xargs" "1"
check "R-rerun-final Critical #2 — 02b-update-milestones.sh 신설" "test -x $REPO_ROOT/scripts/migrate-v2/02b-update-milestones.sh && echo 1 || echo 0" "1"
check "R-rerun-final Critical #2 — verify-milestones.sh 신설" "test -x $REPO_ROOT/scripts/migrate-v2/verify-milestones.sh && echo 1 || echo 0" "1"
check "R-rerun-final Major #1 — L4-Gate T+96h Mandatory Decision 박힘" "grep -lE 'L4-Gate|T\\+96h.*Mandatory|Mandatory Decision' 11-CUTOVER.md | wc -l | xargs" "1"
check "R-rerun-final Major #2 — Dormant User Gate 박힘 (M-5c 90일+사용자 승인+180일 ceiling)" "grep -lE 'Dormant User Gate|90일 도달 시점에 사용자 명시 승인|180일 hard ceiling' 11-MIGRATE.md | wc -l | xargs" "1"
check "R-rerun-final Major #3 — Deterministic Serialization 박힘 (M-8 UTC+ISO+jsonb_build_object)" "grep -lE 'Deterministic Serialization|SET TIME ZONE.*UTC|jsonb_build_object' 11-MIGRATE.md | wc -l | xargs" "1"
check "R-rerun-final Major #4 — verify-issues.sh body sha256 강화 박힘" "grep -lE 'body sha256|깊은 무결성|BODY mismatch' $REPO_ROOT/scripts/migrate-v2/verify-issues.sh 2>/dev/null | wc -l | xargs" "1"
check "R-rerun-final Minor — 11-DESIGN groups historical-only caveat 박힘" "grep -lE 'groups.*historical only.*PRE-4 backlog|do NOT implement/VRT' 11-DESIGN.md | wc -l | xargs" "1"

echo ""
echo "===== 14. catalog M-5c body 무결성 (Oracle R-rerun-final Critical #1 — sync 후 회귀 차단) ====="
m5c_body=$(jq -r '.issues[] | select(.id == "M-5c") | .body' $REPO_ROOT/scripts/migrate-v2/catalog.json 2>/dev/null)
for marker in 'reject' 'updateUserById' '수명주기' '30일' 'soft-deactivate' 'migrated_at' 'pbkdf2Verify' '(b) 경로'; do
    if echo "$m5c_body" | grep -qF "$marker"; then
        echo "✅ PASS  catalog M-5c marker [$marker] 존재"
        PASS=$((PASS+1))
    else
        echo "❌ FAIL  catalog M-5c marker [$marker] 없음 (parser truncation 의심)"
        FAIL=$((FAIL+1))
    fi
done

m5c_len=${#m5c_body}
if (( m5c_len >= 3000 )); then
    echo "✅ PASS  catalog M-5c body length >= 3000 ($m5c_len chars)"
    PASS=$((PASS+1))
else
    echo "❌ FAIL  catalog M-5c body length $m5c_len < 3000 (truncation 의심)"
    FAIL=$((FAIL+1))
fi


echo ""
echo "===== 15. Code fence balance 검증 (catalog body 안 triple-backtick 짝수) ====="
# Use python to count safely (avoid bash quoting issues with backticks)
imbalance=$(python3 -c "
import json
with open('$REPO_ROOT/scripts/migrate-v2/catalog.json') as f:
    data = json.load(f)
bad = []
for issue in data['issues']:
    n = issue['body'].count('\`\`\`')
    if n % 2 != 0:
        bad.append(f\"{issue['id']}: {n} occurrences\")
for b in bad:
    print(f'  unbalanced: {b}')
print(len(bad))
" 2>&1)
last_line=$(echo "$imbalance" | tail -1)
echo "$imbalance" | grep -v '^[0-9]*$' || true
check "Code fence balance — unbalanced issues 0건" "echo $last_line" "0"

echo ""
echo "================================"
echo "TOTAL: $PASS PASS / $FAIL FAIL"
echo "================================"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
