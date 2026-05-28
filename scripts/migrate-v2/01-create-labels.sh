#!/usr/bin/env bash
# 01-create-labels.sh — 라벨 스킴 일괄 생성 (idempotent)
# Usage: ./01-create-labels.sh             (dry-run)
#        APPLY=1 ./01-create-labels.sh     (실 적용)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

require_gh_auth
print_mode_banner

log_info "===== Slice 라벨 (15) ====="
ensure_label "slice:FOUND"    "0E8A16" "Wave 0 — Foundation 복구"
ensure_label "slice:AUTH"     "1D76DB" "인증 시스템 (이메일/소셜/세션)"
ensure_label "slice:DESIGN"   "C2E0C6" "디자인 시스템·VRT·a11y"
ensure_label "slice:PWA"      "BFD4F2" "PWA + FCM 푸시"
ensure_label "slice:MIGRATE"  "B60205" "데이터 마이그레이션 v2"
ensure_label "slice:READER"   "5319E7" "성경 본문 뷰어"
ensure_label "slice:PLAN"     "0052CC" "통독 플랜·일정"
ensure_label "slice:ANNOTATE" "FBCA04" "북마크·하이라이트·노트"
ensure_label "slice:PROGRESS" "D93F0B" "진도 추적·통계"
ensure_label "slice:HASENA"   "5319E7" "하세나"
ensure_label "slice:CATCHUP"  "BFD4F2" "캐치업 (밀린 일정)"
ensure_label "slice:PROFILE"  "1D76DB" "프로필·업적·잔디"
ensure_label "slice:SOCIAL"   "C2E0C6" "친구·스코어보드"
ensure_label "slice:ADMIN"    "FEF2C0" "관리자 (별도 컷오버)"
ensure_label "slice:CUTOVER"  "B60205" "실 컷오버"

log_info "===== 우선순위 라벨 ====="
ensure_label "P0" "B60205" "블로커 — 즉시"
ensure_label "P1" "D93F0B" "컷오버 전 필수"
ensure_label "P2" "FBCA04" "컷오버 직전"
ensure_label "P3" "0E8A16" "안정화 후"
ensure_label "backlog" "CFD3D7" "백로그"

log_info "===== GAP 분류 라벨 ====="
ensure_label "gap:missing"    "D93F0B" "Nuxt에 있는데 Next 없음 — v2 작성 필요"
ensure_label "gap:regression" "B60205" "Next 측 깨짐 (양쪽 다 있음)"
ensure_label "gap:bug"        "B60205" "라이브 확인된 버그"
ensure_label "gap:new"        "0E8A16" "Next 신규 (Nuxt 대응 없음)"
ensure_label "gap:obsolete"   "CFD3D7" "v2 에서 제거"
ensure_label "gap:defer"      "BFD4F2" "PRE 결정에 따라 후순위"

log_info "===== 카테고리 라벨 ====="
ensure_label "type:meta"  "5319E7" "메타 시스템·CI·governance"
ensure_label "type:data"  "B60205" "데이터 마이그레이션·검증"
ensure_label "type:auth"  "1D76DB" "인증·세션"
ensure_label "type:ux"    "FBCA04" "시각·a11y·VRT"
ensure_label "type:test"  "BFD4F2" "테스트 작성·실행"
ensure_label "type:infra" "0052CC" "DNS·OAuth·Vercel·Supabase 설정"
ensure_label "type:docs"  "0075CA" "문서"

log_info "===== 상태 라벨 ====="
ensure_label "state:blocked"     "B60205" "결정 대기"
ensure_label "state:ready"       "0E8A16" "작업 시작 가능"
ensure_label "state:in-progress" "1D76DB" "진행 중"
ensure_label "state:review"      "FBCA04" "PR 리뷰 대기"
ensure_label "state:done"        "0E8A16" "완료 + DoD 통과"

log_info "===== 결정 라벨 ====="
ensure_label "decision"       "5319E7" "의사결정 필요 이슈"
ensure_label "needs-review"   "FBCA04" "검토 필요"

echo ""
log_ok "라벨 생성 완료 (dry-run 여부: $(is_dry_run && echo YES || echo NO))"
