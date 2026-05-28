#!/usr/bin/env bash
# verify-milestones.sh — Oracle R-rerun-final Critical #2 신설.
# Live GH milestone description 의 Wave 메타가 plan SSOT (10-plan-overview.md) 와 일치하는지 검증.
# Usage: ./verify-milestones.sh

set -uo pipefail

REPO="eddieparc/maeil1dok"

PASS=0
FAIL=0

expected_wave_for() {
    case "$1" in
        FOUND) echo "Wave 0" ;;
        MIGRATE) echo "Wave 1" ;;
        AUTH|DESIGN|PWA) echo "Wave 2" ;;
        READER|PLAN|ANNOTATE) echo "Wave 3" ;;
        PROGRESS|HASENA|CATCHUP|PROFILE) echo "Wave 4" ;;
        SOCIAL|ADMIN-CORE) echo "Wave 5" ;;
        CUTOVER) echo "Wave 6" ;;
        ADMIN-EXTENDED|INFRA) echo "" ;;
        *) echo "?" ;;
    esac
}

echo "===== Milestone Wave 일관성 검증 (Oracle R-rerun-final Critical #2) ====="
echo "  SSOT: 10-plan-overview.md §3 + 40-github-mapping.md §1"
echo ""

milestones_json=$(gh api "repos/${REPO}/milestones?state=all&per_page=100" 2>/dev/null)

for slice in FOUND MIGRATE AUTH DESIGN PWA READER PLAN ANNOTATE PROGRESS HASENA CATCHUP PROFILE SOCIAL ADMIN-CORE ADMIN-EXTENDED CUTOVER INFRA; do
    expected=$(expected_wave_for "$slice")
    title=$(echo "$milestones_json" | jq -r ".[] | select(.title | startswith(\"v2/${slice}\")) | .title" | head -1)
    description=$(echo "$milestones_json" | jq -r ".[] | select(.title | startswith(\"v2/${slice}\")) | .description" | head -1)
    if [[ -z "$title" ]]; then
        echo "❌ FAIL  [$slice] milestone 미존재"
        FAIL=$((FAIL+1))
        continue
    fi
    if [[ -z "$expected" ]]; then
        echo "ℹ️  SKIP  [$slice] Wave 무관 (별도 트랙 또는 INFRA)"
        continue
    fi
    if echo "$description" | grep -qF "$expected"; then
        echo "✅ PASS  [$slice] description에 '$expected' 존재"
        PASS=$((PASS+1))
    else
        echo "❌ FAIL  [$slice] description에 '$expected' 없음. 실제: $(echo "$description" | head -c 100)..."
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "================================"
echo "TOTAL: $PASS PASS / $FAIL FAIL"
echo "================================"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
