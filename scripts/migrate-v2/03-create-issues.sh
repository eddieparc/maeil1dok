#!/usr/bin/env bash
# 03-create-issues.sh — catalog.json 기반 이슈 일괄 생성 (idempotent)
# Usage: ./03-create-issues.sh             (dry-run)
#        APPLY=1 ./03-create-issues.sh     (실 적용)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

CATALOG="${SCRIPT_DIR}/catalog.json"

if [[ ! -f "$CATALOG" ]]; then
    log_error "catalog.json 없음. 먼저 'python3 extract-tasks.py' 실행."
    exit 1
fi

require_gh_auth
print_mode_banner

ISSUE_COUNT=$(jq '.issues | length' "$CATALOG")
log_info "catalog: $ISSUE_COUNT issues"
echo ""

mkdir -p "${SCRIPT_DIR}/bodies"

created=0
skipped=0
failed=0

for i in $(seq 0 $((ISSUE_COUNT - 1))); do
    title=$(jq -r ".issues[$i].title" "$CATALOG")
    milestone=$(jq -r ".issues[$i].milestone" "$CATALOG")
    labels=$(jq -r ".issues[$i].labels | join(\",\")" "$CATALOG")
    body=$(jq -r ".issues[$i].body" "$CATALOG")
    task_id=$(jq -r ".issues[$i].id" "$CATALOG")
    body_file="${SCRIPT_DIR}/bodies/${task_id}.md"
    
    echo "$body" > "$body_file"
    
    if issue_exists "$title" "$milestone"; then
        log_ok "skip exists: [${task_id}] $title"
        skipped=$((skipped+1))
        continue
    fi
    
    if is_dry_run; then
        log_info "WOULD CREATE [$task_id]: $title"
        log_info "  milestone: $milestone"
        log_info "  labels: $labels"
        created=$((created+1))
    else
        if gh issue create \
            --title "$title" \
            --body-file "$body_file" \
            --milestone "$milestone" \
            --label "$labels" \
            >/dev/null 2>&1; then
            log_ok "created [$task_id]: $title"
            created=$((created+1))
        else
            log_error "FAILED [$task_id]: $title"
            failed=$((failed+1))
        fi
    fi
done

echo ""
log_info "총: $ISSUE_COUNT / 생성: $created / 스킵: $skipped / 실패: $failed"
[[ $failed -eq 0 ]] || exit 1
