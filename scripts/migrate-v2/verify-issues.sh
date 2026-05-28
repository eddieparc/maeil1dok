#!/usr/bin/env bash
# verify-issues.sh — catalog.json ↔ GitHub 1:1 + 깊은 무결성 검증.
# Oracle R-rerun-final Major #4: 직전 verify-issues.sh 는 title 존재성만 검증 → M-5c body corruption 통과.
# 신 검사: (1) title 1:1 (2) body sha256 (3) milestone (4) labels set equality. task_id marker 로 매칭.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATALOG="${SCRIPT_DIR}/catalog.json"
REPO="eddieparc/maeil1dok"

if [[ ! -f "$CATALOG" ]]; then
    echo "❌ catalog.json 없음"
    exit 1
fi

echo "===== catalog ↔ GitHub 1:1 + 깊은 무결성 검증 (Oracle R-rerun-final Major #4) ====="
echo ""

CATALOG_COUNT=$(jq '.issues | length' "$CATALOG")
echo "[1] catalog issue 수: $CATALOG_COUNT"

mkdir -p /tmp/check
gh issue list -R "$REPO" --limit 500 --state all --json number,title,body,milestone,labels > /tmp/check/all-gh-issues.json
GH_COUNT=$(jq '. | length' /tmp/check/all-gh-issues.json)
echo "[2] GitHub 전체 issue 수: $GH_COUNT"

echo ""
echo "[3] catalog title → GH 존재 여부"
jq -r '.issues[].title' "$CATALOG" | sort > /tmp/check/catalog-titles.txt
jq -r '.[].title' /tmp/check/all-gh-issues.json | sort > /tmp/check/gh-titles.txt
echo "  catalog: $(wc -l < /tmp/check/catalog-titles.txt) titles"
echo "  github : $(wc -l < /tmp/check/gh-titles.txt) titles"
MISSING_IN_GH=$(comm -23 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | wc -l | xargs)
EXTRA_IN_GH=$(comm -13 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | wc -l | xargs)
echo "  catalog 에 있는데 GH 없음: $MISSING_IN_GH"
echo "  GH 에 있는데 catalog 없음: $EXTRA_IN_GH"

if [[ "$MISSING_IN_GH" -gt 0 ]]; then
    echo "  --- 누락 list ---"
    comm -23 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | head -10
fi
if [[ "$EXTRA_IN_GH" -gt 0 ]]; then
    echo "  --- 스코프 외 list ---"
    comm -13 /tmp/check/catalog-titles.txt /tmp/check/gh-titles.txt | head -10
fi

echo ""
echo "[4] catalog ↔ GH 깊은 무결성 (body sha256 / milestone / labels)"

# Iterate catalog issues, find matching GH by task_id marker, compare body/milestone/labels.
BODY_MISMATCH=0
MILESTONE_MISMATCH=0
LABELS_MISMATCH=0
UNMATCHED=0

for i in $(seq 0 $((CATALOG_COUNT - 1))); do
    task_id=$(jq -r ".issues[$i].id" "$CATALOG")
    cat_title=$(jq -r ".issues[$i].title" "$CATALOG")
    cat_body=$(jq -r ".issues[$i].body" "$CATALOG")
    cat_milestone=$(jq -r ".issues[$i].milestone" "$CATALOG")
    cat_labels=$(jq -r ".issues[$i].labels | sort | join(\",\")" "$CATALOG")

    marker="작업 ID**: \`${task_id}\`"
    gh_match=$(jq -r --arg m "$marker" '.[] | select(.body | contains($m))' /tmp/check/all-gh-issues.json | jq -s '.[0]')

    if [[ -z "$gh_match" || "$gh_match" == "null" ]]; then
        echo "  ❌ UNMATCHED [$task_id]: GH 에 task_id marker 없음"
        UNMATCHED=$((UNMATCHED+1))
        continue
    fi

    gh_number=$(echo "$gh_match" | jq -r '.number')
    gh_body=$(echo "$gh_match" | jq -r '.body')
    gh_milestone=$(echo "$gh_match" | jq -r '.milestone.title // ""')
    gh_labels=$(echo "$gh_match" | jq -r '.labels | map(.name) | sort | join(",")')

    cat_hash=$(printf '%s' "$cat_body" | shasum -a 256 | awk '{print $1}')
    gh_hash=$(printf '%s' "$gh_body" | shasum -a 256 | awk '{print $1}')

    if [[ "$cat_hash" != "$gh_hash" ]]; then
        echo "  ❌ BODY mismatch #$gh_number [$task_id]  (cat:${cat_hash:0:12}.. vs gh:${gh_hash:0:12}..)"
        BODY_MISMATCH=$((BODY_MISMATCH+1))
    fi
    if [[ "$cat_milestone" != "$gh_milestone" ]]; then
        echo "  ❌ MILESTONE mismatch #$gh_number [$task_id]  catalog='${cat_milestone}' gh='${gh_milestone}'"
        MILESTONE_MISMATCH=$((MILESTONE_MISMATCH+1))
    fi
    if [[ "$cat_labels" != "$gh_labels" ]]; then
        echo "  ❌ LABELS mismatch #$gh_number [$task_id]  catalog='${cat_labels}' gh='${gh_labels}'"
        LABELS_MISMATCH=$((LABELS_MISMATCH+1))
    fi
done

echo ""
echo "================================"
echo "TITLE: missing_in_gh=$MISSING_IN_GH extra_in_gh=$EXTRA_IN_GH"
echo "DEEP : unmatched=$UNMATCHED body_mismatch=$BODY_MISMATCH milestone_mismatch=$MILESTONE_MISMATCH labels_mismatch=$LABELS_MISMATCH"
echo "================================"

if [[ "$MISSING_IN_GH" -eq 0 && "$EXTRA_IN_GH" -eq 0 && "$UNMATCHED" -eq 0 && "$BODY_MISMATCH" -eq 0 && "$MILESTONE_MISMATCH" -eq 0 && "$LABELS_MISMATCH" -eq 0 ]]; then
    echo "✅ 완벽 1:1 매핑 + 깊은 무결성 통과"
    exit 0
else
    echo "❌ 불일치 검출"
    exit 1
fi
