# 11-ADMIN · Admin 도구 (조건부)

> **슬라이스 ID**: 11-ADMIN — Momus R1 BLOCKING #4 반영해 두 트랙으로 분할  
> - **11-ADMIN-CORE** (Wave 5, 메인 포함): 핵심 쓰기 기능 (플랜 엑셀 업로드, 영상 인트로 업로드, 하세나 요약 재생성). 없으면 컷오버 후 운영 자체가 마비됨.  
> - **11-ADMIN-EXTENDED** (별도 트랙, 컷오버 후): 통계·대시보드·읽기 위주 부분.  
> **의존**: 11-MIGRATE · **크기**: M (CORE) + S (EXTENDED, 후속)

## 1. 목표
Django admin 페이지를 통한 운영자 작업을 Next 측에서 대체. 가장 자주 쓰는 흐름만 v2 포함, 나머지는 Supabase Studio + SQL 로 대체.

## 2. 자산
- Nuxt: [/admin/hasena](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/admin/hasena/index.vue) 524, [/admin/plans](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/admin/plans/index.vue) 1737, [/admin/video/intro](file:///Users/jgp/GitHub/maeil1dok/frontend/app/pages/admin/video/intro.vue) 840
- Django: backend/*/admin.py + 03b §C
- 권한: Django staff/superuser → Supabase 의 service_role 또는 별도 admin role

## 3. 작업 — CORE (메인 컷오버 포함)
| # | 작업 | DoD |
|---|---|---|
| AD-1 | 운영자 권한 모델 — auth.users.user_metadata.role='admin' 또는 별도 admins 테이블 | 정책 확정 |
| AD-2 | 보호된 라우트 (/admin/*) — 미들웨어 가드 | 비관리자 → 403 |
| AD-3 | 하세나 요약 생성/재생성 — Gemini API 호출 (Vercel Edge function) | UI + API 동작 (없으면 컷오버 후 신규 요약 차단 — CORE) |
| AD-4 | 통독 플랜 엑셀 업로드 → daily_schedules 생성 | 업로드 후 row 추가 검증 (없으면 신규 플랜 생성 불가능 — CORE) |
| AD-5 | 비디오 인트로 업로드 | 동일 (CORE — 매주 새 영상 등록 필요) |

## 4. 작업 — EXTENDED (컷오버 후 별도 트랙)
| # | 작업 | DoD |
|---|---|---|
| AD-6 | Django admin 의 나머지 모델 — Supabase Studio 안내 (커스텀 admin 작성 X) | README 안내 |
| AD-7 | Admin 대시보드 (사용자 수, 활동량 등) | 별도 컷오버 |
| AD-8 | 사용자 검색/관리 | 별도 |

## 4. 결정
- ADD-1 (= PRE-6): Admin 도구 v2 포함 / 별도 컷오버 / 백로그
- ADD-2: 어드민 권한 모델 — role-based / 단순 boolean
- ADD-3: 엑셀 파싱 라이브러리 (Next 측)

## 5. DoD
- EVIDENCE: admin route 가드 시도 + 핵심 흐름 e2e
- ASSERTION: 비관리자 403 / 관리자 정상 / 데이터 변경 후 row count 검증
