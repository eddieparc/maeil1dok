## 슬라이스 / 작업
**슬라이스**: `slice:MIGRATE`  
**플랜**: docs/migration-v2/11-MIGRATE.md  
**작업 ID**: `M-5c`

## 작업 내용
**PBKDF2 → `password_verification_hook` 방식 + 전체 스키마 명시** (Oracle R2 Critical #1 + Oracle R-final Major #3, 자가 R3 Self-1, Self-critique MAJOR M3) — Supabase `password_verification_hook` (Auth Hooks 카테고리) 으로 외부 검증. **선행 의무: F-17 (Supabase tier 사전 확인) 통과 후 진입.** F-17 결과 Pro tier 필요 + 사용자 비용 승인 시 (a) 경로, 불가 시 (b) 강제 reset 경로 자동 회귀.<br><br>**(a) 경로 — 전체 스키마 명시 (Oracle R-final Major #3)**:<br>1. **`legacy_password_hashes` 테이블** (server-only, RLS 거부, service_role 만 read; auth schema 또는 별도 `_migration` schema):<br>   ```sql<br>   CREATE TABLE _migration.legacy_password_hashes (<br>     user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,<br>     algo text NOT NULL CHECK (algo='pbkdf2_sha256'),<br>     iterations int NOT NULL,<br>     salt text NOT NULL,<br>     hash text NOT NULL,<br>     created_at timestamptz DEFAULT now(),<br>     migrated_at timestamptz NULL  -- Supabase password 로 옮긴 시점<br>   );<br>   ALTER TABLE _migration.legacy_password_hashes ENABLE ROW LEVEL SECURITY;<br>   -- service_role 외 모든 role 접근 거부 (default deny)<br>   ```<br>2. **Hook request schema** (Supabase → Edge function):<br>   ```json<br>   {"user_id": "uuid", "password": "plain text from sign-in attempt", "email": "..."}<br>   ```<br>3. **Hook response schema** (Edge function → Supabase):<br>   ```json<br>   {"decision": "continue"

## 의존성 (Mn5)
- 선행: `F-17`

## DoD (Definition of Done)
- [ ] **CHANGE** — diff 파일 목록 (PR 머지 시 자동)
- [ ] **EVIDENCE** — `.sisyphus/evidence/MIGRATE-M-5c.{txt,png,json}`
- [ ] **REPRODUCE** — 재현 명령 1줄
- [ ] **ASSERTION** — (a): 5명 sample staging 환경 첫 로그인 통과 + `_migration.legacy_password_hashes.migrated_at` 갱신 검증 + 30일 cron 동작 검증 (`.sisyphus/evidence/11-MIGRATE-password-hook.txt`). (b): reset 발송 row count + 30일 후 응답률 (`.sisyphus/evidence/11-MIGRATE-password-reset.txt`)

## 차단 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지
- 인증 우회 스크린샷 통과 처리 금지
- `as unknown as X` PR 명시 승인 없이 사용 금지
