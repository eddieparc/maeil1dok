#!/usr/bin/env bash
# sync-issues.sh — catalog ↔ GitHub 동기화
# Self-critique MAJOR M5 — title/body 변경된 catalog issue 와 GH issue 양방향 sync.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

CATALOG="${SCRIPT_DIR}/catalog.json"
[[ -f "$CATALOG" ]] || { log_error "catalog.json 없음"; exit 1; }

require_gh_auth
print_mode_banner

mkdir -p /tmp/check
log_info "GH 전체 이슈 1회 fetch (body 포함)"
gh issue list --limit 500 --state all --json number,title,body > /tmp/check/all-gh-issues.json
log_info "  $(jq '. | length' /tmp/check/all-gh-issues.json) issues fetched"

ISSUE_COUNT=$(jq '.issues | length' "$CATALOG")
log_info "catalog: $ISSUE_COUNT issues"

mkdir -p "${SCRIPT_DIR}/bodies"

created=0
updated=0
unchanged=0
failed=0

for i in $(seq 0 $((ISSUE_COUNT - 1))); do
    task_id=$(jq -r ".issues[$i].id" "$CATALOG")
    title=$(jq -r ".issues[$i].title" "$CATALOG")
    milestone=$(jq -r ".issues[$i].milestone" "$CATALOG")
    labels=$(jq -r ".issues[$i].labels | join(\",\")" "$CATALOG")
    body=$(jq -r ".issues[$i].body" "$CATALOG")
    body_file="${SCRIPT_DIR}/bodies/${task_id}.md"
    echo "$body" > "$body_file"
    
    marker="작업 ID**: \`${task_id}\`"
    gh_issue=$(jq -r --arg m "$marker" '.[] | select(.body | contains($m)) | {number, title, body}' /tmp/check/all-gh-issues.json | jq -s '.[0]')
    
    if [[ -z "$gh_issue" || "$gh_issue" == "null" ]]; then
        if is_dry_run; then
            log_info "WOULD CREATE [$task_id]: $title"
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
                log_error "FAILED create [$task_id]"
                failed=$((failed+1))
            fi
        fi
        continue
    fi
    
    gh_number=$(echo "$gh_issue" | jq -r '.number')
    gh_title=$(echo "$gh_issue" | jq -r '.title')
    gh_body=$(echo "$gh_issue" | jq -r '.body')
    
    title_changed="no"
    body_changed="no"
    [[ "$gh_title" != "$title" ]] && title_changed="yes"
    [[ "$gh_body" != "$body" ]] && body_changed="yes"
    
    if [[ "$title_changed" == "no" && "$body_changed" == "no" ]]; then
        unchanged=$((unchanged+1))
        continue
    fi
    
    if is_dry_run; then
        log_info "WOULD UPDATE #$gh_number [$task_id] (title:$title_changed body:$body_changed)"
    else
        if gh issue edit "$gh_number" \
            --title "$title" \
            --body-file "$body_file" \
            >/dev/null 2>&1; then
            log_ok "updated #$gh_number [$task_id]: $title"
            updated=$((updated+1))
        else
            log_error "FAILED update #$gh_number [$task_id]"
            failed=$((failed+1))
        fi
    fi
done

echo ""
log_info "총: $ISSUE_COUNT / 생성: $created / 갱신: $updated / 변경없음: $unchanged / 실패: $failed"
[[ $failed -eq 0 ]] || exit 1
