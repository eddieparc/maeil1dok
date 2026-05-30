# 11-AUTH · 인증 시스템 (이메일/소셜/세션)

> **슬라이스 ID**: 11-AUTH  
> **Wave**: 2 (병렬 — MIGRATE 산출물 위에서; Oracle R-final Critical #1 + Momus #1 일관화)  
> **의존**: 11-FOUND, 11-MIGRATE  
> **추정 크기**: M  
> **상태**: 스켈레톤 — 03a 인증 엔드포인트 + [`docs/audit_tmp/AUTH_FIX_SUMMARY.md`](file:///Users/jgp/GitHub/maeil1dok/docs/audit_tmp/AUTH_FIX_SUMMARY.md) 의 직전 버그 증거 기반 (Momus R-rerun-19 fix — 실 경로 `docs/audit_tmp/` 명시)

---

## 1. 목표

이메일 / Kakao / Google / Apple 로그인이 **새 도메인(Vercel) + Supabase Auth** 위에서 다음 보장:

1. 로그인 후 새로고침해도 세션 유지 (직전 버그 #1, #2, #3 재발 금지)
2. 첫 OAuth 로그인 시 `auth.identities` 자동 생성 → 사전 매핑된 `auth.users` UUID 와 연결
3. 이메일/비밀번호 사용자는 "비밀번호 재설정" 안내 (Django bcrypt → Supabase 이전 불가)
4. 토큰 노출, CORS wildcard, `print()` 토큰 로깅 등 직전 보안 이슈 0건

---

## 2. 기존 자산 (재활용 + 검증 필요)

### 2.1 Django 측 (03a-backend-api §A·B·D)

| Django 흐름 | 엔드포인트 | v2 처리 |
|---|---|---|
| 토큰 발급 | `/api/v1/auth/token/`, `/api/v1/auth/login/`, `/api/v1/auth/email-login/` | **폐기** — Supabase Auth가 대체 |
| 토큰 갱신 | `/api/v1/auth/token/refresh/` | 폐기 |
| 로그아웃 | `/api/v1/auth/logout/`, `logout-all/` | 폐기 (Supabase signOut) |
| CSRF | `/api/v1/auth/csrf/` | 폐기 (Supabase는 다른 모델) |
| 인증 검증 | `/api/v1/auth/user/`, `/api/v1/auth/verify/` | 폐기 (Supabase getUser) |
| 회원가입 | `/api/v1/auth/register/`, `/api/v1/accounts/email-register/` | **Supabase signUp** 으로 대체 |
| 소셜 로그인 | `/api/v1/auth/social-login/`, `social-login/v2/`, `complete-kakao-signup/`, `complete-social-signup/` | **Supabase OAuth** 로 대체 |
| 닉네임/유저명 체크 | `/check-nickname/`, `/check-username/` | **Supabase RPC** 또는 Next API route |
| 비밀번호 재설정 | `/api/v1/accounts/forgot-password/` 흐름 | **Supabase resetPasswordForEmail** |
| 이메일 인증 | `send-verification/`, `verify-email/`, `resend-verification/` | **Supabase email_confirm** 흐름 |
| 소셜 연동/해제 | `link-social/`, `unlink-social/`, `linked-accounts/`, `merge-accounts/` | Next API route + Supabase auth.identities 직접 관리 (커스텀) |
| 세션 브리지 | `session_bridge_issue/consume/` | **삭제** (마이그레이션 일시 도구) |

### 2.2 Next 측 기존 코드 (02 도착 후 매핑 보완)

- [src/lib/supabase/middleware.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/lib/supabase/middleware.ts) — 세션 갱신 (02 도착 후 검증)
- [src/middleware.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/middleware.ts) — Apple POST 콜백 처리 + maintenance 분기 — 검증
- `src/app/auth/callback/` — OAuth 콜백 핸들러
- `src/app/(public)/login/` — 로그인 페이지
- `src/app/(public)/register-email/` — 이메일 가입

### 2.3 Nuxt 측 사용자 시나리오 (01-nuxt-inventory §1 페이지 표 발췌)

| 페이지 | 흐름 |
|---|---|
| /login | 이메일 + 소셜(Kakao/Google/Apple) 진입 |
| /register-email | 이메일 가입 (닉네임 체크 + 이메일 인증 발송) |
| /register | (구) 가입 양식 — username/nickname 체크 |
| /auth/[provider]/callback | OAuth 콜백 토큰 교환 |
| /auth/kakao/setup, /google/setup | 소셜 가입 시 닉네임/프로필 보완 |
| /auth/forgot-password | 비밀번호 재설정 이메일 발송 |
| /auth/reset-password | 토큰 검증 + 새 비밀번호 |
| /auth/verify-email | 이메일 인증 완료 처리 |
| /auth/error | 인증 오류 안내 |
| /account/settings | 비밀번호 변경, 소셜 연동/해제, 회원 탈퇴, 계정 병합 |

각 페이지의 Next 대응 상태는 02 도착 후 표 확정.

---

## 3. 작업 항목

### 3.1 Supabase Auth 인프라

| # | 작업 | DoD |
|---|---|---|
| A-1 | Supabase 프로젝트의 Auth Settings 검증: Site URL=`https://maeil1dok.app`, Additional Redirect URLs 정확 | dashboard 스크린샷 + curl 콜백 동작 확인 |
| A-2 | Kakao/Google OAuth Provider 등록 — Client ID/Secret 적용 + 콜백 URL 확인 | OAuth 진입 → Supabase 콜백 도달 확인 |
| A-3 | Apple Sign In Provider 등록 (Self-critique MAJOR M4) — credential **4개 모두**: (1) Service ID (`com.maeil1dok.web.signin`) (2) Team ID (Apple Developer 계정) (3) Key ID (.p8 발급 시 부여) (4) Private Key (.p8 파일 내용). Supabase Auth Provider 설정에 모두 입력. 누락 시 OAuth flow `invalid_client` 에러 | OAuth 진입 → Apple 인증 페이지 도달 + 콜백 정상 |

### 3.2 핵심 흐름

| # | 작업 | DoD |
|---|---|---|
| A-4 | 이메일 로그인 — `signInWithPassword` 흐름 | playwright: 가입→로그인→리프레시 후 세션 유지 |
| A-5 | 이메일 가입 — `signUp` + email confirmation | playwright: 가입→확인 메일 수신→인증 클릭→자동 로그인 |
| A-6 | Kakao 로그인 — `signInWithOAuth` 흐름 | playwright: 카카오 진입 → 콜백 → 인증된 페이지 도달 |
| A-7 | Google 로그인 — 동일 | 동일 |
| A-8 | Apple 로그인 — Apple은 POST 콜백 처리 (middleware.ts §16 존재) | 동일 |
| A-9 | 로그아웃 — `signOut` + 세션 정리 | curl: 로그아웃 후 보호 라우트 401 |
| A-10 | 세션 새로고침 — `updateSession` middleware 동작 검증 | playwright: 5분 idle 후 새로고침 → 세션 유지 |

### 3.3 회복 흐름

| # | 작업 | DoD |
|---|---|---|
| A-11 | 비밀번호 재설정 메일 발송 — `resetPasswordForEmail` | 메일 수신 확인 |
| A-12 | 재설정 토큰으로 새 비밀번호 설정 — `updateUser({password})` | 새 비번 로그인 확인 |
| A-13 | "마이그레이션된 비밀번호 사용자" 안내 — 첫 로그인 시 비번 재설정 강제 흐름 | UX: 가입 시 metadata.requires_password_reset 플래그 |

### 3.4 소셜 연동/해제 (Nuxt /account/settings 대응)

| # | 작업 | DoD |
|---|---|---|
| A-14 | 현재 연동된 identity 목록 — `auth.identities` 쿼리 (Service role API route 필요) | Next API route + 화면 표시 |
| A-15 | 추가 소셜 연동 — `linkIdentity()` | 연동 후 identities 표 갱신 |
| A-16 | 소셜 연동 해제 — `unlinkIdentity()` | 해제 후 identities 표 갱신 |
| A-17 | 회원 탈퇴 — soft delete (auth.users.user_metadata.scheduled_deletion) + 데이터 보존 정책 | 정책 확정 + 실행 |
| A-18 | 계정 병합 — Django의 `merged_into` 대응. v2 정책 결정 필요 | 결정 + 구현 또는 백로그 이전 |

### 3.5 닉네임 정책

| # | 작업 | DoD |
|---|---|---|
| A-19 | 닉네임 unique 정책 — `profiles.nickname UNIQUE` 또는 RPC 검증 | DB constraint + 사용 시 친절한 에러 |
| A-20 | 닉네임 체크 API — `/api/check-nickname` Next route | 응답 200/409 동작 |
| A-21 | 가입 시 닉네임 자동 제안 — Django는 OAuth 가입 시 보완 페이지로 보냄 | 정책 정의 + 구현 |

### 3.6 직전 버그 회귀 방지

이 슬라이스의 검증 통과 기준에 다음을 **명시적으로** 포함:

| 회귀 방지 | 검증 |
|---|---|
| 새로고침 시 로그아웃 (Django 버그 #1~#3) | playwright: 로그인 → F5 새로고침 → 인증 상태 유지 (시나리오: immediate / 5min idle) |
| 토큰 응답 본문 노출 | curl 응답 본문에 access_token 문자열 없음 grep |
| CORS wildcard | Supabase + Vercel 설정에서 명시적 origin 목록 |
| `print()` 토큰 로깅 | Next/Supabase Edge function 코드에 `console.log(token)` 패턴 grep = 0 |

### 3.7 CI 환경 제약 (Oracle Major #4)

**문제**: Vercel Preview URL (`*-pr-123.vercel.app`) 은 동적 — Kakao/Apple OAuth 가 사전 등록된 Redirect URI 만 허용하므로 모든 PR Playwright CI 가 OAuth 단계에서 무한 실패.

**대응**:
| 환경 | OAuth E2E 정책 |
|---|---|
| Local (`localhost:3000`) | 정상 진행 (각 OAuth provider 의 dev redirect URI 에 사전 등록) |
| Staging (고정 도메인 `staging.maeil1dok.app`) | 정상 진행 (provider 에 사전 등록) |
| Vercel Preview (`*.vercel.app`) | **Mock 모드** — Supabase Auth 의 `signInWithIdToken` 으로 가짜 토큰 주입 또는 OAuth 단계 skip + 인증 후 상태 stub |
| Production (`maeil1dok.app`) | 정상 진행 |

**DoD 분리**:
- A-6 (Kakao E2E), A-7 (Google E2E), A-8 (Apple E2E) 의 ASSERTION 은 **Staging 통과** 시 PASS. PR Preview CI 에서는 Mock 단계 통과만 ASSERT.
- Mocking 코드는 `tests/e2e/utils/auth-mock.ts` 에 분리. production build 에 포함 금지 (placeholder grep CI 와 동일 규칙).

---

## 4. 결정 사항

| 결정 | 옵션 |
|---|---|
| AD-1 | 회원 탈퇴 시 데이터: cascade delete vs soft (Django `scheduled_deletion_at` 패턴) |
| AD-2 | 계정 병합 (Django `merged_into`): v2 포함 / 백로그 |
| AD-3 | 이메일/비밀번호 마이그레이션 사용자 첫 로그인 UX: 강제 reset / 안내만 |
| AD-4 | 세션 유지 기간: Supabase 기본 / 커스텀 |

---

## 5. 의존성

| 의존 | 슬라이스 |
|---|---|
| 빌드 그린, 환경, WIP 정리 | 11-FOUND |
| auth.users 매핑 (Django → Supabase UUID) | 11-MIGRATE 와 양방향 |

11-MIGRATE 가 사전 사용자 생성을 하고, 본 슬라이스가 그 사용자들의 첫 OAuth 로그인을 처리한다.

---

## 6. DoD 통합

- **CHANGE**: src/app/auth/, src/lib/supabase/, src/app/(public)/login/, src/app/api/profile/, 관련 컴포넌트
- **EVIDENCE**: 
  - `.sisyphus/evidence/11-AUTH-playwright/` — 8개 시나리오 트레이스
  - `.sisyphus/evidence/11-AUTH-refresh-persistence.json` — 새로고침 후 세션 유지 자동 테스트 결과
- **REPRODUCE**: `npx playwright test tests/e2e/auth/*.spec.ts`
- **ASSERTION**:
  - 8/8 auth scenarios pass
  - 0 console.error containing "Auth session missing"
  - Refresh persistence: pass × 3 (immediate/5min/1h)
  - Token leak grep: 0 hits

<!-- plan-checksum: PENDING -->
