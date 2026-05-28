# 30 · Oracle Final Review

## Verdict: **REJECT** (도메인 모순 및 치명적 운영 위험 검출)

Momus가 5회에 걸쳐 계획의 표면적/논리적 빈틈(5% 임계 모순, Wave 의존성 등)을 훌륭히 방어했습니다. 그러나 시스템 아키텍처, 데이터 모델, 실제 운영 환경의 물리적 한계를 교차 검증한 결과, **치명적 데이터 유실과 심각한 UX 붕괴를 초래할 도메인 레벨의 모순 2건(Critical)** 과 **지속 가능성 위험 3건(Major)** 이 발견되었습니다.

이 항목들은 Gate G 진입 전 반드시 플랜에 반영(수정)되어야 합니다.

---

## 1. Domain Contradiction (CRITICAL): 소셜 계정(OAuth) 영구 유실 위험

- **증거**: `05-feature-matrix.md` §3 (도메인 모델)에서 `SocialAccount` → `auth.identities` 매핑을 **"OBSOLETE (Supabase 자동)"** 으로 분류하고 마이그레이션 대상에서 제외함.
- **위험 (Data Loss)**: Supabase는 기존 사용자의 Kakao/Google/Apple 고유 식별자(`provider_id`, `subject`)를 "자동으로" 알 수 없습니다. 사용자가 새 앱에서 소셜 로그인을 시도할 때, Supabase는 이메일을 기준으로 기존 `auth.users`와 연결(Link)을 시도합니다. 그러나 **Apple Private Relay(가상 이메일)를 사용했거나 Kakao에서 이메일 제공을 동의하지 않은 사용자**는 이메일 매칭이 불가능하여 완전히 새로운 빈 계정이 생성됩니다. 기존의 모든 통독 기록(`user_progress`)과 연결이 영구적으로 끊어집니다.
- **조치 요구**: `11-MIGRATE.md`에 Django `SocialAccount` 테이블을 Supabase `auth.identities` 테이블로 명시적으로 마이그레이션(provider, provider_id 매핑)하는 단계를 필수 추가하십시오. `05-feature-matrix.md`의 OBSOLETE 판정을 번복해야 합니다.

## 2. User Impact (CRITICAL): 48시간 Read-Only UX 함정

- **증거**: `11-CUTOVER.md` C-9b (MySQL `INSERT/UPDATE` 권한 REVOKE) 및 C-14b (DNS 캐시 잔존 사용자를 위해 48시간 동안 VPS Django를 Read-only 모드로 유지).
- **위험 (Silent Failure)**: 예전 DNS를 바라보는 기존 Nuxt 클라이언트는 UI가 정상적으로 로드됩니다. 사용자가 "읽음" 버튼을 누르거나 노트를 저장할 때, 백엔드 DB 권한이 없으므로 500 에러가 발생하거나 앱이 조용히 실패합니다. 사용자는 자신이 기록을 남겼다고 착각하지만 실제로는 저장되지 않는 **Silent Data Loss**가 DNS가 갱신될 때까지(최대 48시간) 지속됩니다.
- **조치 요구**: Read-only 모드 유지를 폐기하십시오. 구 서버(VPS)에 도달하는 모든 API 트래픽에 대해 HTTP 503 (Service Unavailable)과 함께 "앱이 업데이트되었습니다. 앱을 완전히 종료 후 다시 실행해주세요"라는 명시적인 **Hard Block UI**를 반환하도록 Nginx 또는 Nuxt/Django 설정을 변경하는 작업을 `11-CUTOVER`에 추가하십시오.

## 3. Meta-System Sustainability (MAJOR): IaC(코드형 인프라) 부재

- **증거**: `11-FOUND.md` 및 `00-meta-system.md` 등 문서 전체에서 Supabase CLI(`supabase init`, `supabase/migrations/`) 적용에 대한 언급이 전무함.
- **위험 (Drift)**: Django 시절에는 `makemigrations`로 스키마를 코드로 관리했습니다. v2에서 Dashboard UI 클릭만으로 테이블과 RLS를 생성하면, 몇 주 내로 Git 레포지토리와 실제 DB 스키마 간의 **Drift(괴리)** 가 발생하여 로컬 테스트와 CI/CD가 불가능해집니다. 6개월 뒤 이 프로젝트를 다시 열었을 때 메타 시스템이 붕괴합니다.
- **조치 요구**: `11-FOUND.md`에 Supabase CLI 초기화 및 스키마/RLS 변경 사항을 반드시 `supabase/migrations/*.sql` 코드로 커밋하도록 강제하는 규칙을 도입하십시오.

## 4. External Dependency (MAJOR): Vercel Preview의 OAuth E2E 실패

- **증거**: `11-AUTH.md` A-6, A-7 (Kakao/Google 로그인 Playwright E2E 강제).
- **위험 (CI Blocker)**: Kakao와 Apple은 사전 등록된 정확한 Redirect URI만 허용합니다. Vercel의 동적 Preview URL(`*-pr-123.vercel.app`)에서는 OAuth 콜백이 무조건 거부됩니다. 따라서 모든 PR의 Playwright CI가 필연적으로 실패(FAIL)하여 00-meta-system의 "빌드/테스트 그린 강제" 규칙이 개발을 멈추게 합니다.
- **조치 요구**: `11-AUTH.md`의 DoD를 수정하여, OAuth E2E 검증은 "고정된 Staging 도메인 또는 Local 환경"으로 한정하고, PR Preview CI에서는 Mocking으로 우회하거나 해당 테스트를 Skip하도록 예외 조항을 명시하십시오.

## 5. Domain Contradiction (MAJOR): 비밀번호 마이그레이션 포기

- **증거**: `11-AUTH.md` A-13 ("마이그레이션된 비밀번호 사용자 첫 로그인 시 비번 재설정 강제 흐름").
- **위험 (User Drop-off)**: Django의 기본 비밀번호 해시(PBKDF2)는 Supabase `auth.users`의 `encrypted_password` (PHC 포맷 변환) 로 직접 이식이 기술적으로 가능합니다. 이를 포기하고 기존 이메일 가입자 전원에게 "비밀번호 재설정"을 강제하는 것은 대규모 활성 사용자 이탈(Drop-off)을 초래하는 치명적 UX 퇴행입니다.
- **조치 요구**: 강제 재설정은 최후의 수단이어야 합니다. `11-MIGRATE.md`에 Django PBKDF2 해시를 Supabase Auth 포맷으로 변환하여 포팅하는 방안을 우선 탐색 및 검증하는 단계를 추가하십시오.

---

### [결론 및 다음 단계]
위 5개 항목은 Momus가 잡은 표면적 논리 무결성을 넘어선, 실제 운영/아키텍처 수준의 결함입니다. 
본 문서를 바탕으로 `05-feature-matrix.md`, `11-MIGRATE.md`, `11-CUTOVER.md`, `11-AUTH.md`, `11-FOUND.md`를 수정(결정사항 `*D-N` 추가 등)한 뒤, Gate G(GH 이슈 일괄 생성) 작업으로 넘어가기 전 사용자에게 수용 여부를 확인받으십시오.
