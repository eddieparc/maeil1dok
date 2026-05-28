#!/usr/bin/env bash
# 02-create-milestones.sh — 16개 milestone 일괄 생성 (idempotent)
# Usage: ./02-create-milestones.sh             (dry-run)
#        APPLY=1 ./02-create-milestones.sh     (실 적용)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

require_gh_auth
print_mode_banner

log_info "===== v2 Milestones (17) — Oracle R-rerun-final Critical #2 (Wave 일관화) + Momus #2 (ADMIN CORE/EXTENDED 분리) 반영 ====="

# Wave assignment SSOT: 10-plan-overview.md §3 + 40-github-mapping.md §1.
# 직전 02-create-milestones.sh 는 옛 Wave (AUTH/DESIGN/PWA=1, MIGRATE=2) 하드코딩 → live milestone description stale.
# ensure_milestone 은 idempotent: 기존 시 description 갱신 안 함. 따라서 신규 milestone 만 본 스크립트로 생성하고,
# 기존 milestone description 갱신은 02b-update-milestones.sh (gh api PATCH) 가 담당.

ensure_milestone "v2/INFRA — 메타 시스템·CI"          "AI 실수 방지 시스템, plan-checksum 동기화, placeholder grep CI 등. (00-meta-system.md)"

ensure_milestone "v2/FOUND — Foundation 복구"          "빌드 그린(TS 에러 5건), Vitest 통과, WIP 커밋 정리, 환경 복구. Wave 0. (11-FOUND.md)"

ensure_milestone "v2/MIGRATE — 데이터 마이그레이션 v2" "Plan F 95% 손실 fix. 5% hard fail·멱등성·라운드 트립 20명·Critical 3 digest hash. Wave 1 (직렬 단독). (11-MIGRATE.md)"

ensure_milestone "v2/AUTH — 인증 시스템"               "이메일·소셜(Kakao/Google/Apple)·세션·새로고침 영속·소셜 연동/해제. Wave 2 (MIGRATE 산출물 위에서 병렬). (11-AUTH.md)"

ensure_milestone "v2/DESIGN — 디자인 검증"             "VRT 회복(dark testMatch+35407px diff), a11y 7건, 다크모드 잔존. Wave 2 (data 무관 병렬). (11-DESIGN.md)"

ensure_milestone "v2/PWA — PWA+FCM"                    "PWA 매니페스트·iOS 호환·FCM 토큰·통독 리마인더. Wave 2 (인프라 선행). (11-PWA.md)"

ensure_milestone "v2/READER — 성경 뷰어"               "BUG-001/004 회귀 방지. URL 단방향·본문 표시·역본·인터랙션. Wave 3. (11-READER.md)"

ensure_milestone "v2/PLAN — 통독 플랜·일정"            "플랜 구독/해지·캘린더·일정 표시. Wave 3. (11-PLAN.md)"

ensure_milestone "v2/ANNOTATE — 북마크·하이라이트·노트" "BUG-005 placeholder 제거 + UI 완성. Wave 3. (11-ANNOTATE.md)"

ensure_milestone "v2/PROGRESS — 진도 추적"             "user_progress 95% 손실 회복. 읽음 토글·통계·잔디. Wave 4. (11-PROGRESS.md)"

ensure_milestone "v2/HASENA — 하세나"                  "오늘 일정·요약·과거 조회. Wave 4. (11-HASENA.md)"

ensure_milestone "v2/CATCHUP — 캐치업"                 "캐치업 세션 preview/create/toggle. Wave 4. (11-CATCHUP.md)"

ensure_milestone "v2/PROFILE — 프로필·업적·잔디"        "Achievement 재계산(PRE-6). Wave 4. (11-PROFILE.md)"

ensure_milestone "v2/SOCIAL — 친구·스코어보드"          "친구·팔로우·스코어보드. T0002/T0004 회귀 방지. 그룹은 PRE-4 backlog. Wave 5. (11-SOCIAL.md)"

ensure_milestone "v2/ADMIN-CORE — 관리자 핵심 (메인 컷오버 포함, PRE-5)" "AD-1~5 핵심 쓰기 기능 (플랜 엑셀 / 영상 인트로 / 하세나 요약). 메인 컷오버 포함. Wave 5. (11-ADMIN.md §3)"

ensure_milestone "v2/ADMIN-EXTENDED — 관리자 확장 (컷오버 후, PRE-5)" "AD-6~8 통계·대시보드·사용자 검색. 메인 컷오버 후 별도 트랙. (11-ADMIN.md §4)"

ensure_milestone "v2/CUTOVER — 실 컷오버"               "DNS 전환·OAuth·smoke·VPS 폐기·Hard Block 503·Cache invalidation 5중·Incident Ladder L1~L4. Wave 6 (마지막). (11-CUTOVER.md)"

echo ""
log_ok "Milestone 생성 완료 (dry-run 여부: $(is_dry_run && echo YES || echo NO))"
