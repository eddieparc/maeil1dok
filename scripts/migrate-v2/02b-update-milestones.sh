#!/usr/bin/env bash
# 02b-update-milestones.sh — Oracle R-rerun-final Critical #2 fix.
# ensure_milestone (02-create-milestones.sh) 은 기존 milestone description 갱신 안 함.
# 본 스크립트는 모든 기존 milestone 의 description 을 02-create-milestones.sh 와 동일한 SSOT 로 강제 갱신.
# Usage: APPLY=1 ./02b-update-milestones.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

require_gh_auth
print_mode_banner

REPO="eddieparc/maeil1dok"

declare_milestone() {
    local title="$1"
    local description="$2"
    local number
    number=$(gh api "repos/${REPO}/milestones?state=all" --jq ".[] | select(.title == \"${title}\") | .number" 2>/dev/null | head -1)
    if [[ -z "$number" ]]; then
        log_warn "milestone 미존재 (먼저 02-create-milestones.sh 실행 필요): $title"
        return 0
    fi
    if is_dry_run; then
        log_info "WOULD PATCH #${number} [$title]"
    else
        if gh api "repos/${REPO}/milestones/${number}" --method PATCH -f description="$description" >/dev/null 2>&1; then
            log_ok "patched #${number} [$title]"
        else
            log_error "FAILED patch #${number} [$title]"
        fi
    fi
}

declare_milestone "v2/INFRA — 메타 시스템·CI"          "AI 실수 방지 시스템, plan-checksum 동기화, placeholder grep CI 등. (00-meta-system.md)"
declare_milestone "v2/FOUND — Foundation 복구"          "빌드 그린(TS 에러 5건), Vitest 통과, WIP 커밋 정리, 환경 복구. Wave 0. (11-FOUND.md)"
declare_milestone "v2/MIGRATE — 데이터 마이그레이션 v2" "Plan F 95% 손실 fix. 5% hard fail·멱등성·라운드 트립 20명·Critical 3 digest hash. Wave 1 (직렬 단독). (11-MIGRATE.md)"
declare_milestone "v2/AUTH — 인증 시스템"               "이메일·소셜(Kakao/Google/Apple)·세션·새로고침 영속·소셜 연동/해제. Wave 2 (MIGRATE 산출물 위에서 병렬). (11-AUTH.md)"
declare_milestone "v2/DESIGN — 디자인 검증"             "VRT 회복(dark testMatch+35407px diff), a11y 7건, 다크모드 잔존. Wave 2 (data 무관 병렬). (11-DESIGN.md)"
declare_milestone "v2/PWA — PWA+FCM"                    "PWA 매니페스트·iOS 호환·FCM 토큰·통독 리마인더. Wave 2 (인프라 선행). (11-PWA.md)"
declare_milestone "v2/READER — 성경 뷰어"               "BUG-001/004 회귀 방지. URL 단방향·본문 표시·역본·인터랙션. Wave 3. (11-READER.md)"
declare_milestone "v2/PLAN — 통독 플랜·일정"            "플랜 구독/해지·캘린더·일정 표시. Wave 3. (11-PLAN.md)"
declare_milestone "v2/ANNOTATE — 북마크·하이라이트·노트" "BUG-005 placeholder 제거 + UI 완성. Wave 3. (11-ANNOTATE.md)"
declare_milestone "v2/PROGRESS — 진도 추적"             "user_progress 95% 손실 회복. 읽음 토글·통계·잔디. Wave 4. (11-PROGRESS.md)"
declare_milestone "v2/HASENA — 하세나"                  "오늘 일정·요약·과거 조회. Wave 4. (11-HASENA.md)"
declare_milestone "v2/CATCHUP — 캐치업"                 "캐치업 세션 preview/create/toggle. Wave 4. (11-CATCHUP.md)"
declare_milestone "v2/PROFILE — 프로필·업적·잔디"        "Achievement 재계산(PRE-6). Wave 4. (11-PROFILE.md)"
declare_milestone "v2/SOCIAL — 친구·스코어보드"          "친구·팔로우·스코어보드. T0002/T0004 회귀 방지. 그룹은 PRE-4 backlog. Wave 5. (11-SOCIAL.md)"
declare_milestone "v2/ADMIN-CORE — 관리자 핵심 (메인 컷오버 포함, PRE-5)" "AD-1~5 핵심 쓰기 기능 (플랜 엑셀 / 영상 인트로 / 하세나 요약). 메인 컷오버 포함. Wave 5. (11-ADMIN.md §3)"
declare_milestone "v2/ADMIN-EXTENDED — 관리자 확장 (컷오버 후, PRE-5)" "AD-6~8 통계·대시보드·사용자 검색. 메인 컷오버 후 별도 트랙. (11-ADMIN.md §4)"
declare_milestone "v2/CUTOVER — 실 컷오버"               "DNS 전환·OAuth·smoke·VPS 폐기·Hard Block 503·Cache invalidation 5중·Incident Ladder L1~L4. Wave 6 (마지막). (11-CUTOVER.md)"

echo ""
log_ok "Milestone description 갱신 완료 (dry-run 여부: $(is_dry_run && echo YES || echo NO))"
