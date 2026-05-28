#!/usr/bin/env bash
# verify-issues.sh — catalog.json 의 모든 issue 가 GitHub 에 1:1 등록됐는지 검증
# Self-critique MAJOR M5

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATALOG="${SCRIPT_DIR}/catalog.json"

if [[ ! -f "$CATALOG" ]]; then
    echo "❌ catalog.json 없음"
    exit 1
fi

echo "===== catalog ↔ GitHub 1:1 검증 ====="
echo ""

CATALOG_COUNT=$(jq '.issues | length' "$CATALOG")
echo "[1] catalog issue 수: $CATALOG_COUNT"

GH_COUNT=$(gh issue list --limit 500 --state all --json number | jq '. | length')
echo "[2] GitHub 전체 issue 수: $GH_COUNT"

echo ""
echo "[3] catalog title → GH 존재 여부 검증"

mkdir -p /tmp/check
jq -r '.issues[].title' "$CATALOG" | sort > /tmp/check/catalog-titles.txt
gh issue list --limit 500 --state all --json title --jq '.[].title' | sort > /tmp/check/gh-titles.txt

echo "  catalog: $(wc -l < /tmp/check/catalog-titles.txt) titles"
echo "  github : $(wc -l < /tmp/check/gh-titles.txt) titles"

MISSING_IN_GH=$(comm -23 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | wc -l | xargs)
EXTRA_IN_GH=$(comm -13 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | wc -l | xargs)

echo ""
echo "[4] 결과"
echo "  catalog 에 있는데 GH 없음 (생성 필요): $MISSING_IN_GH"
echo "  GH 에 있는데 catalog 없음 (스코프 외): $EXTRA_IN_GH"

if [[ "$MISSING_IN_GH" -gt 0 ]]; then
    echo ""
    echo "  --- 누락 list ---"
    comm -23 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | head -10
fi

if [[ "$EXTRA_IN_GH" -gt 0 ]]; then
    echo ""
    echo "  --- 스코프 외 list ---"
    comm -13 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | head -10
fi

echo ""
if [[ "$MISSING_IN_GH" -eq 0 && "$EXTRA_IN_GH" -eq 0 ]]; then
    echo "✅ 완벽 1:1 매핑"
    exit 0
else
    echo "❌ 불일치 검출"
    exit 1
fi
