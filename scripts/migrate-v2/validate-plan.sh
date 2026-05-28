#!/usr/bin/env bash
# validate-plan.sh — docs/migration-v2/ 의 모든 문서가 메타 시스템 규칙을 통과하는지 자가 검증
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
check "Nuxt 페이지 fs=41" "find $REPO_ROOT/frontend/app/pages -name '*.vue' | wc -l | xargs" "41"
check "Next pages fs=35" "find $REPO_ROOT/maeil1dok-next/src/app -name 'page.tsx' | wc -l | xargs" "35"
check "Django models fs=28" "grep -rhE '^class [A-Z][A-Za-z]+\\(.*Model' $REPO_ROOT/backend/*/models.py | wc -l | xargs" "28"
check "Supabase migrations fs=7" "ls $REPO_ROOT/maeil1dok-next/supabase/migrations/*.sql | wc -l | xargs" "7"

echo ""
echo "===== 4. 핵심 메타 규칙 시행 검증 ====="
check "Critical 3 0% hard fail 박힘" "grep -lE 'Critical 3.*0%|0% hard fail' 11-MIGRATE.md | wc -l | xargs" "1"
check "Fix-Forward Only 박힘" "grep -lE 'Fix-Forward Only' 11-CUTOVER.md | wc -l | xargs" "1"
check "Hard Block 503 박힘 (Oracle R1 Critical #2)" "grep -lE 'Hard Block 503' 11-CUTOVER.md | wc -l | xargs" "1"
check "Wave 1 단독 MIGRATE 박힘" "grep -lE 'Wave 1.*직렬 단독|Wave 1 \\(직렬' 10-plan-overview.md | wc -l | xargs" "1"
check "ADMIN-CORE / EXTENDED 분할 박힘" "grep -lE 'ADMIN-CORE' 10-plan-overview.md | wc -l | xargs" "1"
check "SocialAccount MIGRATE 박힘 (Oracle R1 Critical #1)" "grep -lE 'SocialAccount.*MIGRATE' 11-MIGRATE.md | wc -l | xargs" "1"
check "password_verification_hook 박힘 (Oracle R2 #1 + 자가 R3 Self-1)" "grep -lE 'password_verification_hook' 11-MIGRATE.md | wc -l | xargs" "1"
check "Trigger 충돌 우회 박힘 (Oracle R2 Critical #2)" "grep -lE 'Trigger 충돌 우회|DISABLE TRIGGER' 11-MIGRATE.md | wc -l | xargs" "1"
check "identity_data JSONB 박힘 (Oracle R2 Major #3)" "grep -lE 'identity_data JSONB' 11-MIGRATE.md | wc -l | xargs" "1"
check "구 클라이언트 503 처리 역검증 (Oracle R2 Major #4)" "grep -lE 'C-9c|구 클라이언트 503 처리' 11-CUTOVER.md | wc -l | xargs" "1"
check "service_role 유출 차단 (Oracle R2 Major #5)" "grep -lE 'service_role key 유출 차단|NEXT_PUBLIC_.*SERVICE_ROLE' 00-meta-system.md | wc -l | xargs" "1"
check "Supabase IaC 박힘 (Oracle R1 Major #3)" "grep -lE 'Supabase CLI 도입|supabase init' 11-FOUND.md | wc -l | xargs" "1"
check "Vercel Preview Mock 박힘 (Oracle R1 Major #4)" "grep -lE 'Vercel Preview.*Mock|Mock 모드' 11-AUTH.md | wc -l | xargs" "1"

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
    | grep -vE "^2[01]-momus" \
    | wc -l | xargs)
check "추측 표현 untagged 0 (critique·size·root-cause 제외)" "echo $untagged" "0"

echo ""
echo "================================"
echo "TOTAL: $PASS PASS / $FAIL FAIL"
echo "================================"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
