# 11-MIGRATE · 데이터 마이그레이션 v2

> **슬라이스 ID**: 11-MIGRATE  
> **Wave**: 1 (직렬 단독 — DB 파괴적 작업이므로 병렬 금지; Oracle R-final Critical #1 + Momus #1 일관화)  
> **의존**: 11-FOUND  
> **추정 크기**: L  
> **상태**: 스켈레톤 — Plan F의 실패 (95% 데이터 손실) 직접 대응

---

## 1. 목표

Django/MySQL → Supabase/PostgreSQL 데이터 마이그레이션을 **5% 손실 = hard fail** 기준으로 통과시킨다.
직전 Plan F dry-run 의 user_progress 95% 손실, profiles 68% 손실 등 모든 손실 영역의 root cause를 진단/해결.

---

## 2. 직전 실패 분석 (validation_report.json 2026-03-02)

| 테이블 | Django | Supabase | 손실률 | 추정 원인 |
|---|---|---|---|---|
| profiles | 203 | 64 | -68.5% | 사용자 사전 생성 단계에서 142명 누락 |
| plan_subscriptions | 463 | 88 | -81.0% | 사용자 UUID 매핑 실패 → cascade silent skip |
| user_progress | 7,921 | 381 | -95.2% | subscription UUID 매핑 실패 + cascade |
| hasena_records | 383 | 4 | -99.0% | 사용자 매핑 실패 |
| user_video_intro_progress | 121 | 4 | -96.7% | 사용자 매핑 실패 |
| user_reading_settings | 96 | 49 | -49.0% | 사용자 매핑 실패 |
| user_plan_display_settings | 463 | 88 | -81.0% | subscription cascade |
| user_highlights | 205 | 153 | -25.4% | 부분 매핑 실패 |
| bible_bookmarks | 3 | 1 | -66.7% | 데이터셋 작아 진단 어려움 |
| **daily_schedules** | 1106 | 1113 | **+7행** | **멱등성 위반 — 재실행 시 중복 삽입** |

**근본 원인**: `02-create-supabase-users.ts` 가 203명 중 63명만 생성한 시점에서 user_mapping이 망가졌고, 03b가 fail-soft로 142명의 모든 자식 row를 warn만 남기고 skip 처리. 이 silent skip이 통과로 분류됨.

---

## 3. v2 변경점 (Plan F 대비, Momus R1 반영 후)

| 측면 | Plan F | v2 |
|---|---|---|
| 매핑 실패 정책 | warn + skip (fail-soft) | **hard fail** (이름 + 사유 list 출력 후 exit 1) |
| 손실 임계 — 일반 테이블 | 5% warn 표시 | **5% hard fail (Valid Users 분모 기준)** |
| **손실 임계 — Critical 3 테이블** (profiles, plan_subscriptions, user_progress) | — | **0% hard fail (1건이라도 누락 → exit 1)** — Momus R1 Major #2 |
| **검증 분모 보정** (Momus R1 BLOCKING #1 + Oracle R-final Critical #3) | Django 전체 row | **Valid Users SSOT: `scripts/migrate/sql/valid_users.sql` — deterministic Django query**. skip 사용자는 **전수 enumeration + 사유 분류 + 사용자 명시 승인 게이트** 후만 분모에서 제외. `data/skipped_users.json` 과대 생성으로 95% 손실 위장 차단 |
| 멱등성 검증 | 없음 | **두 번 돌려도 row count 동일 + Critical 3 + auth.users + auth.identities 의 deterministic digest hash 동일** (Oracle R-final Major #1) |
| 사용자 사전 생성 검증 | 생성 카운트만 | **샘플 20명 라운드 트립 — 가장 데이터 많은 5명 + 없는 5명 + 무작위 10명** (Momus R1 Minor #2) |
| 사용자 매핑 실패 진단 | 없음 | **누락 사유 분류 + 사용자 ID 전수 출력**. `data/skipped_users.json` 에 `{user_id, email, reason}` 으로 저장. Momus R1 Hidden #2: "전부 정당 skip" 가정 금지 — 무작위 5명을 사용자 검증으로 spot check 의무. Oracle R-final Critical #3: skip 사용자가 **20명 초과 시 무작위 5명이 아닌 전수 사용자 승인 게이트** 적용 (manifest 조작 차단) |
| Rate limit 대응 (Momus R1 Hidden #1) | 100ms delay | **Supabase Admin API throttle 사전 측정 + Cloudflare 우회 (직접 supabase.co)**. 4xx/5xx 시 exponential backoff + 본인 IP block 가능성 사전 경고 |
| RUNBOOK | 있음, 재활용 | v2 적합화 |

---

## 4. 작업 항목

### 4.0 사용자/identity/profile 마이그레이션 순서 (자가 R3 Self-5 + Oracle R-final Critical #2 정정)

> **Oracle R-final Critical #2 반영**: Supabase managed 환경에서 `auth.users` 의 trigger 는 owner 가 `supabase_auth_admin` 으로 service_role 이 DISABLE 권한 없음. 직전 안 (`트리거 DISABLE → ... → RE-ENABLE`) 은 권한 실패. **M-5d 의 ON CONFLICT 방식과 일치**. 순서표를 다음으로 교체:

**엄격 순서 — race condition 방지**:
```
1. Maintenance/signup hard block ON (Supabase Dashboard 또는 RLS, 신규 가입 자체 차단)
   ← 트리거 DISABLE 대신 신규 가입 차단으로 우회 (M-5d ON CONFLICT 와 병행)
2. auth.users 사전 생성 (M-5, password_verification_hook 등록)
   ← 트리거 on_auth_user_created 가 동작해도 빈 profiles row 만 만듦 (UPSERT 가 덮어씀)
3. auth.identities 연결 (M-5b, identity_data JSONB 완비; M-5e schema)
4. profiles UPSERT (M-2~M-4 사용자 매핑 + skip 사유 분류; ON CONFLICT (user_id) DO UPDATE SET ...)
5. 나머지 자식 테이블 (user_progress 등) 로딩
6. Maintenance/signup hard block OFF (컷오버 직후, 또는 Wave 6 C-13)
```

각 단계는 직렬. 병렬 금지 (race 위험).

**금지 패턴 (validator hard fail)**: `ALTER TABLE auth.users DISABLE TRIGGER`, `트리거 DISABLE`, `RE-ENABLE`. Supabase managed 환경에서 권한 없음. `validate-plan.sh` 가 critique 본문(`20-`/`21-`/`30-`/`32-` 등) 외 영역에서 검출 시 FAIL.

### 4.1 사용자 사전 생성 강화 (Plan F의 02-* 재작성)

| # | 작업 | DoD |
|---|---|---|
| M-1 | Supabase Admin API rate limit 정확한 한계 측정 — 100명 batch 실험 | 한계치 / 추천 delay 기록 |
| M-2 | **Valid Users SSOT 정의** (Oracle R-final Critical #3) — `scripts/migrate/sql/valid_users.sql` 작성. deterministic query: `SELECT id, email FROM accounts_user WHERE scheduled_deletion_at IS NULL AND merged_into IS NULL` (+ 추가 제외 조건은 사용자 명시 승인 후만). **`valid_users.sql` 외 다른 query 는 분모로 사용 금지** (validator grep). 사용자 skip 사유 enum 정의: `scheduled_deletion / merged_into / duplicate_email / other` (+ "other" 카운트 > 0 시 사용자 승인 게이트). 동적 검증: `Django valid_users.sql count == Supabase auth.users 매핑 수 + skip 사유별 합계` | `valid_users.sql` 커밋 + 검증식 통과 + skip 사유별 카운트 보고서 (`scheduled_deletion_at` N1 / `merged_into` N2 / 중복 이메일 N3 / 기타 N4) + 기타 카운트 ≥ 1 시 사용자 승인 evidence |
| M-3 | 중복 이메일 (이메일 + 소셜 같은 이메일) 케이스 정책 — **자동 병합 (이메일 unique 가정, 동일 이메일이면 같은 사용자로 통합)** (Self-critique MAJOR M1). 단, 두 Django 계정에 다른 progress 가 있으면 더 활성 계정 우선 + 다른 계정의 progress merge | 정책 + 코드 + 테스트 + merge 우선순위 명시 |
| M-4 | `scheduled_deletion_at` / `merged_into` 사용자 처리 — skip but log to separate file | `data/deleted_users.json` + `data/merged_users.json` |
| M-5 | `02-create-supabase-users.ts` v2 — 위 4개 반영 | 실행 시 user_mapping.json 의 entries 수 = 활성 사용자 수 (203 - 의도적 skip) |
| **M-5b-pre** | **`auth.identities` 쓰기 메커니즘 사전 검증** (Self-critique B1) — 빈 Supabase 프로젝트에 1건 sample 로 (a) `service_role` 로 `auth.identities` 직접 INSERT 시도, (b) 실패 시 `supabase.auth.admin.linkIdentity()` API 시도, (c) 둘 다 실패 시 `supabase.auth.admin.createUser({...identities})` 통합 생성 시도. 동작하는 경로 1개 입증 후 M-5b 진입. | 1건 sample 로 `auth.identities` 에 row 존재 입증 + 사용한 method 보고서 |
| **M-5b** | **SocialAccount → auth.identities 명시적 마이그레이션** (Oracle Critical #1, Mn8 + Oracle R-final Major #2) — M-5b-pre 에서 입증된 경로로 Django `accounts_socialaccount` 의 모든 row 를 마이그레이션. `provider` + `provider_id` + `user_id (mapped UUID)` + `identity_data` (M-5e). **Mn8: auth.identities 의 PK (UUID `id`) 정책 — Supabase 자동 생성. Django SocialAccount.id 는 보존 안 함 (Supabase 의 UUID 로 대체). FK 참조 없으므로 무방.** | (a) Django SocialAccount count == Supabase auth.identities count. (b) **실 OAuth/token exchange 검증 — migrated social test account 1건당 staging 환경에서 실제 Kakao/Google/Apple OAuth 진행 → `supabase.auth.getUser()` 결과의 `id` 가 `user_mapping[django_user_id]` 와 정확히 일치 (각 provider 1건 = 3건 + 무작위 5명 추가 = 8건 검증)**. (c) `auth.identities` 유니크 제약 검증: `(provider, provider_id)` 중복 0건, `(user_id, provider)` 중복 0건. row 존재만으로는 첫 로그인 시 새 빈 계정 생성 차단 불충분 — 실 token exchange 가 사전 매핑 UUID 와 연결되는지 동작 검증 의무 |
| **M-5c** | **PBKDF2 → `password_verification_hook` 방식 + 전체 스키마 명시** (Oracle R2 Critical #1 + Oracle R-final Major #3, 자가 R3 Self-1, Self-critique MAJOR M3) — Supabase `password_verification_hook` (Auth Hooks 카테고리) 으로 외부 검증. **선행 의무: F-17 (Supabase tier 사전 확인) 통과 후 진입.** F-17 결과 Pro tier 필요 + 사용자 비용 승인 시 (a) 경로, 불가 시 (b) 강제 reset 경로 자동 회귀.<br><br>**(a) 경로 — 전체 스키마 명시 (Oracle R-final Major #3)**:<br>1. **`legacy_password_hashes` 테이블** (server-only, RLS 거부, service_role 만 read; auth schema 또는 별도 `_migration` schema):<br>   ```sql<br>   CREATE TABLE _migration.legacy_password_hashes (<br>     user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,<br>     algo text NOT NULL CHECK (algo='pbkdf2_sha256'),<br>     iterations int NOT NULL,<br>     salt text NOT NULL,<br>     hash text NOT NULL,<br>     created_at timestamptz DEFAULT now(),<br>     migrated_at timestamptz NULL  -- Supabase password 로 옮긴 시점<br>   );<br>   ALTER TABLE _migration.legacy_password_hashes ENABLE ROW LEVEL SECURITY;<br>   -- service_role 외 모든 role 접근 거부 (default deny)<br>   ```<br>2. **Hook request schema** (Supabase → Edge function):<br>   ```json<br>   {"user_id": "uuid", "password": "plain text from sign-in attempt", "email": "..."}<br>   ```<br>3. **Hook response schema** (Edge function → Supabase):<br>   ```json<br>   {"decision": "continue" | "reject", "message": "optional"}<br>   ```<br>4. **Edge function 로직** (`supabase/functions/password-verification-hook/index.ts`):<br>   ```ts<br>   const legacy = await supabase.from('_migration.legacy_password_hashes').select('*').eq('user_id', user_id).single();<br>   if (!legacy.data || legacy.data.migrated_at) return { decision: "continue" };  // 이미 Supabase password 사용<br>   const ok = await pbkdf2Verify(password, legacy.data.salt, legacy.data.iterations, legacy.data.hash);<br>   if (!ok) return { decision: "reject", message: "Invalid password" };<br>   // 검증 통과 → Supabase password 로 set (admin API) + legacy row 마킹<br>   await supabase.auth.admin.updateUserById(user_id, { password });<br>   await supabase.from('_migration.legacy_password_hashes').update({ migrated_at: new Date() }).eq('user_id', user_id);<br>   return { decision: "continue" };<br>   ```<br>5. **수명주기 + Dormant User Gate** (Oracle R-rerun-final Major #2): 사용자 첫 로그인 시 legacy hash 검증 통과 → Supabase password set → `migrated_at` 마킹. **30일 후 미마이그레이션 row 자동 삭제 금지** — 직전 안 (30일 cron 자동 삭제) 은 모바일-only / 휴면 / 푸시-only 사용자를 silent soft-lock. 신 정책: (a) **30일/60일/90일 단계별 reset 안내 메일** (cron). (b) **90일 도달 시점에 사용자 명시 승인 gate** — `unmigrated_password_users` query 실행 → count + 최근 활동 (last_seen_at) + 이메일 발송 가능 여부 (email_verified, bounce 이력) report 출력 → count > 0 이면 사용자에게 `data/unmigrated_users.json` 전체 list + 분류 (last_seen < 30d / 30~90d / 90d+) 제출 + 명시 승인 후만 삭제 진행. (c) **삭제 직전 강제 reset campaign evidence 의무** — 최소 3회 reset 메일 발송 (T-30d / T-7d / T-1d) + 발송 로그 + bounce/open rate 기록 후 사용자 최종 승인. **VPS Django 폐기 (C-21~C-24) 와 무관하게 legacy hash 는 Supabase 측에 90일+α 보존** (VPS 삭제 후에도 검증 가능). 무기한 보존 차단을 위해 **180일 hard ceiling** (180일 도달 시 사용자 결정 강제, 추가 연장 시 별도 plan).<br>6. **legacy_password_hashes 데이터 출처**: Django `accounts_user.password` 컬럼 (`pbkdf2_sha256$iter$salt$hash` 포맷) 파싱 → M-5 시점에 함께 insert.<br><br>**(b) 경로 — 강제 reset**: F-17 결과 hook 사용 불가 시 모든 이메일 사용자에게 reset 메일 + 30일 grace period + 미응답 시 soft-deactivate. | (a): 5명 sample staging 환경 첫 로그인 통과 + `_migration.legacy_password_hashes.migrated_at` 갱신 검증 + 30일 cron 동작 검증 (`.sisyphus/evidence/11-MIGRATE-password-hook.txt`). (b): reset 발송 row count + 30일 후 응답률 (`.sisyphus/evidence/11-MIGRATE-password-reset.txt`) |
| **M-5d** | **Trigger 충돌 우회 — ON CONFLICT 방식** (Oracle R2 Critical #2 + Oracle R-final Critical #2, 자가 R3 Self-2, Self-critique B2) — `on_auth_user_created` 트리거가 `profiles` 자동 생성. **Supabase managed 환경에서 service_role 은 `auth.users` 의 trigger 제어 권한 없음 (table owner: `supabase_auth_admin`)**. **DISABLE/RE-ENABLE 절대 금지** (validator hard fail). **`profiles INSERT ... ON CONFLICT (user_id) DO UPDATE SET ...`** 사용. 트리거가 빈 profiles row 를 먼저 만들어도 우리 데이터로 덮어쓰기. + maintenance/signup hard block 으로 신규 가입은 별도 차단 (Supabase Auth Settings `disable_signup=true` 또는 RLS). | profiles UPSERT 시 충돌 0건 (ON CONFLICT 의 DO UPDATE 가 처리) + profiles 의 모든 컬럼이 Django UserProfile 값으로 셋팅됨 + `disable_signup=true` 적용 검증 |
| **M-5e** | **`auth.identities` identity_data JSONB 완비** (Oracle R2 Major #3, 자가 R3 Self-3) — GoTrue schema 정확히: `{"sub": provider_id, "email": email, "email_verified": true, "phone_verified": false, "provider_id": provider_id, ...optional provider-specific}`. `sub` 와 `provider_id` 모두 명시 (둘 다 GoTrue 가 참조). | 5명 spot check: identity_data.sub == identity_data.provider_id == auth.identities.provider_id |

### 4.2 5% Hard Fail 검증 강화 (Plan F의 04-validate 재작성)

| # | 작업 | DoD |
|---|---|---|
| M-6 | `04-validate.ts` v2 — **분모 보정**: Valid Users (=Django total - 정당 skip) 기준. 일반 테이블 5% / **Critical 3 테이블 (profiles/plan_subscriptions/user_progress) 0% exhaustive count match (sample 아닌 전수)** hard fail. **Mn6: Critical 3 는 SQL count diff 로 전수 비교 — M-9 의 20명 round-trip 은 추가 sample 검증 layer** | 의도적 1건 누락 주입 → user_progress 검증 시 exit 1 + 전수 count 일치 확인 |
| M-7 | FK 무결성 → 0 orphan 확인 (이미 통과 중이지만 강화) | 위반 시 hard fail |
| M-8 | **멱등성 검증 + Digest Hash + Deterministic Serialization + Column Manifest** (Oracle R-final Major #1 + Oracle R-rerun-final Major #3 + Oracle R-rerun-final-2 Major #1) — 동일 마이그레이션 2회 → (a) row count delta = 0 + (b) **Critical 3 + auth.users + auth.identities 의 deterministic digest hash 동일** + (c) **각 테이블별 column manifest 일치 (`information_schema.columns - allowlisted_exclusions == manifest.columns` assertion)**. **deterministic serialization 강제** (Postgres 버전/timezone/DateStyle/null normalization/json key ordering 차이로 false diff 방지):<br>```sql<br>-- 세션 격리: 매 검증 실행 직전 의무<br>SET TIME ZONE 'UTC';<br>SET datestyle = 'ISO, YMD';<br>SET extra_float_digits = 3;<br><br>-- natural_key uniqueness 사전 assertion (위반 시 abort)<br>SELECT count(*) = count(DISTINCT natural_key) FROM target_table;  -- 반드시 true<br><br>-- jsonb_build_object 로 컬럼 명시 + null coalesce + timestamp ISO<br>SELECT encode(<br>  sha256(<br>    (SELECT jsonb_agg(<br>      jsonb_build_object(<br>        'pk', natural_key,<br>        'col1', coalesce(col1, ''),<br>        'col2', coalesce(col2::text, ''),<br>        'ts', to_char(ts_col AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<br>      ) ORDER BY natural_key<br>    ) FROM target_table)::text::bytea<br>  ), 'hex'<br>);<br>```<br><br>**Column Manifest (Oracle R-rerun-final-2 Major #1 — 후속 컬럼 누락 차단)**:<br><br>각 digest 대상 테이블의 포함 컬럼 / 제외 컬럼 / natural_key 식별 방법을 `scripts/migrate/sql/digest-manifest.json` 으로 SSOT 관리. 누락 컬럼 (예: `profiles.avatar_url` 같은 마이그레이션 후 추가된 신 컬럼) 자동 검출:<br>```json<br>{<br>  "profiles": {<br>    "natural_key": "user_id",<br>    "key_source": "direct",<br>    "include_columns": ["user_id", "nickname", "email", "avatar_url", "scheduled_deletion_at", "created_at", "updated_at"],<br>    "exclude_columns": []<br>  },<br>  "plan_subscriptions": {<br>    "natural_key": "(user_id, plan_id)",<br>    "key_source": "direct",<br>    "include_columns": ["user_id", "plan_id", "is_active", "started_at", "created_at"],<br>    "exclude_columns": ["id"]<br>  },<br>  "user_progress": {<br>    "natural_key": "(user_id, schedule_id)",<br>    "key_source": "join-derived",<br>    "key_join_sql": "user_progress up JOIN plan_subscriptions ps ON up.subscription_id = ps.id  -- user_id 는 ps.user_id 로 derive",<br>    "include_columns": ["subscription_id", "schedule_id", "completed_at", "created_at"],<br>    "exclude_columns": ["id"],<br>    "note": "user_progress 테이블 자체에는 user_id 컬럼 없음. natural_key 의 user_id 는 subscription_id → plan_subscriptions JOIN 으로 derive"<br>  },<br>  "auth.users": {<br>    "natural_key": "email",<br>    "key_source": "direct",<br>    "include_columns": ["email", "email_confirmed_at", "raw_user_meta_data", "created_at"],<br>    "exclude_columns": ["id", "encrypted_password", "confirmation_token", "recovery_token", "instance_id"]<br>  },<br>  "auth.identities": {<br>    "natural_key": "(provider, provider_id)",<br>    "key_source": "direct",<br>    "include_columns": ["provider", "provider_id", "user_id", "identity_data", "created_at"],<br>    "exclude_columns": ["id", "last_sign_in_at"]<br>  }<br>}<br>```<br><br>**Manifest assertion (digest 직전 실행 의무)**:<br>```sql<br>-- 각 테이블 마다: 실 DB 컬럼 - 제외 == manifest 포함<br>WITH actual AS (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY column_name),<br>     manifest AS (SELECT unnest(ARRAY['user_id','nickname','email','avatar_url','scheduled_deletion_at','created_at','updated_at']) AS column_name ORDER BY column_name),<br>     excluded AS (SELECT unnest(ARRAY[]::text[]) AS column_name)<br>SELECT<br>  (SELECT array_agg(column_name) FROM (SELECT column_name FROM actual EXCEPT SELECT column_name FROM excluded) a) =<br>  (SELECT array_agg(column_name) FROM manifest);  -- 반드시 true<br>```<br>이 assertion 실패 시: (a) manifest 가 stale (마이그레이션 후 컬럼 추가됨 — `avatar_url` 같은 사례) → manifest 업데이트 + 사용자 승인. (b) 의도된 신 컬럼 → exclude 또는 include 추가. **`information_schema.columns` 와 manifest 의 deterministic diff 없이는 digest 통과 금지**.<br><br>natural_key 정의: profiles=user_id, plan_subscriptions=(user_id, plan_id), **user_progress=(user_id, schedule_id) — user_id 는 subscription_id JOIN plan_subscriptions 로 derive (테이블에 직접 컬럼 없음)**, auth.users=email, auth.identities=(provider, provider_id). **`row_to_json(t)` 대신 `jsonb_build_object` 명시 사용** — column ordering / null serialization 안정성 확보. row count 동일만으로는 UUID 재매핑/timestamp overwrite/identity relink 검출 불가 — digest 가 변질 차단. | row count delta = 0 + digest hash 5개 모두 동일 (`.sisyphus/evidence/11-MIGRATE-digest-{run1,run2}.txt` 두 파일 sha256sum 일치) + natural_key uniqueness 5/5 assertion pass + 세션 격리 SET 문 evidence + **column manifest assertion 5/5 pass (`scripts/migrate/sql/digest-manifest.json` 와 `information_schema.columns` deterministic diff = 0)** |
| M-9 | 라운드 트립 샘플 — **20명** (max-data 5 + zero-data 5 + 무작위 10) × 모든 자식 테이블 row count 일치 + 필드 spot check | 통과 |
| M-9b | **Skip 사용자 spot check + 전수 게이트** (Momus R1 Hidden #2 + Oracle R-final Critical #3) — `data/skipped_users.json` 의 사용자를 Django 측에서 직접 SELECT 해 `scheduled_deletion_at` / `merged_into` / 중복 이메일 여부 확인. **|skip| ≤ 20: 전수 검증. |skip| > 20: 무작위 10명 + 사용자에게 `data/skipped_users.json` 전체 list 제출하고 명시 승인 받기 (CLI prompt 또는 GH Issue) — manifest 조작으로 분모 줄여 95% 손실 위장 차단** | 모든 skip 사용자가 정당 skip 입증 + 사용자 승인 evidence (|skip| > 20 시) |
| M-10 | daily_schedules +7행 원인 추적 + 멱등성 fix | 원인 보고서 + fix 적용 후 재현 시 +0 |

### 4.3 새 테이블 / 마이그레이션 검토

| # | 작업 | DoD |
|---|---|---|
| M-11 | [supabase/migrations/20260301000001_plan_f_new_tables.sql](../../maeil1dok-next/supabase/migrations/20260301000001_plan_f_new_tables.sql) 검증 — bible_bookmarks/reflection_notes/personal_reading_records/migration_user_mapping | 적용 + 스키마 검증 |
| M-12 | 그룹 기능 (`ReadingGroup`, `GroupMembership`, `GroupInvitation`) — v2 포함 여부 결정 | 결정 + 포함 시 SQL 작성 |
| M-13 | `BibleContentCache` — Supabase로 옮길지 / 재생성할지 결정 | 결정 + 실행 |

### 4.4 스크립트 인프라

| # | 작업 | DoD |
|---|---|---|
| M-14 | `01-extract-mysql.ts` 의 `main().catch(console.error)` → `process.exit(1)` 적용 (00-meta-system F5 대응) | 실패 시 정확한 exit code |
| M-15 | `data/` 디렉토리 .gitignore 확실히 들어 있는지 검증 + 검증 명령 자동화 | gitignore 확인 + CI 검증 |
| M-16 | `run-migration.ts` 의 step 4 fail 시 정확한 에러 메시지 + log path 출력 | dry-run + 에러 시뮬레이션 |

### 4.5 도메인 모델 매핑 합의 (03b 기반)

03b-backend-domain.md 의 28개 Django 모델 × Supabase 테이블 매핑 표 합의:

| Django 모델 | Supabase 테이블 | v2 정책 |
|---|---|---|
| User | auth.users + profiles | MIGRATE (사전 생성) |
| **SocialAccount** | **auth.identities** | **MIGRATE (Oracle Critical #1 — 명시적)** — Apple Private Relay / Kakao 이메일 미제공 사용자는 자동 매칭 불가. `provider` + `provider_id` 를 service_role 로 `auth.identities` 에 직접 insert. M-5b 참조 |
| UserProfile | profiles | MIGRATE |
| Follow | user_follows | MIGRATE |
| UserAchievement | — | **SKIP** (Plan F 정책 유지) |
| UserReadingSettings | user_reading_settings | MIGRATE |
| EmailVerificationToken | — | SKIP (Supabase Auth) |
| PasswordResetToken | — | SKIP (Supabase Auth) |
| BibleReadingPlan | bible_reading_plans | MIGRATE |
| PlanSubscription | plan_subscriptions | MIGRATE |
| DailyBibleSchedule | daily_schedules | MIGRATE (멱등성 fix 후) |
| UserBibleProgress | user_progress | MIGRATE (가장 중요) |
| VideoBibleIntro | video_bible_intros | MIGRATE |
| UserVideoIntroProgress | user_video_intro_progress | MIGRATE |
| HasenaRecord | hasena_records | MIGRATE |
| HasenaSummary | hasena_summaries | MIGRATE |
| VisitorCount | — | SKIP (Vercel Analytics) |
| CatchupSession | catchup_sessions | MIGRATE |
| CatchupSchedule | catchup_schedules | MIGRATE |
| UserPlanDisplaySettings | user_plan_display_settings | MIGRATE |
| UserReadingPosition | user_reading_positions | MIGRATE |
| BibleBookmark | bible_bookmarks (NEW) | MIGRATE |
| ReflectionNote | reflection_notes (NEW) | MIGRATE |
| BibleHighlight | user_highlights | MIGRATE (memo 제외 — Plan F 정책 재확인 필요) |
| PersonalReadingRecord | personal_reading_records (NEW) | MIGRATE |
| ReadingGroup | — | **SKIP** (PRE-4 백로그 확정, Momus #2 일관화. 11-SOCIAL §3 S-4~S-6 도 백로그) |
| GroupMembership | — | **SKIP** (PRE-4) |
| GroupInvitation | — | **SKIP** (PRE-4) |
| BibleContentCache | bible_content_cache | **결정 필요** (재생성 vs 이전) |

---

## 5. 결정 사항

| 결정 | 옵션 |
|---|---|
| ~~MD-1~~ | ~~그룹 3개 모델 마이그레이션~~ | **PRE-4 백로그 확정 (재논의 금지) — Momus #2 일관화** |
| MD-2 | UserAchievement 처리 | 폐기 (Plan F) / 재계산 (v2 신규 로직) |
| MD-3 | BibleHighlight.memo | 제외 (Plan F) / 포함 |
| MD-4 | BibleContentCache | 재생성 / DB 이전 |
| MD-5 | 중복 이메일 사용자 | 자동 병합 / 명시 알림 |
| MD-6 | 컷오버 전 dry-run 횟수 | 최소 N회 통과 후만 실 컷오버 |

---

## 6. DoD 통합

- **CHANGE**: scripts/migrate/* v2 + supabase/migrations/* 추가
- **EVIDENCE**: 
  - `.sisyphus/evidence/11-MIGRATE-dry-run-report.json` — overall=pass
  - `.sisyphus/evidence/11-MIGRATE-idempotency.txt` — 2회 실행 row count 동일
  - `.sisyphus/evidence/11-MIGRATE-digest-{run1,run2}.txt` — Critical 3 + auth.users + auth.identities digest hash sha256 일치 (Oracle R-final Major #1)
  - `.sisyphus/evidence/11-MIGRATE-round-trip.txt` — **20명 샘플 일치** (Oracle R-final Minor #1 — M-9 와 통일)
  - `.sisyphus/evidence/11-MIGRATE-valid-users.sql.out` — `valid_users.sql` 실행 결과 + skip 사용자 list + 사용자 승인 evidence (Oracle R-final Critical #3)
  - `.sisyphus/evidence/11-MIGRATE-oauth-uuid-{kakao,google,apple,random-5}.txt` — staging 환경 실 OAuth → `getUser().id == user_mapping[django_user_id]` 일치 검증 (Oracle R-final Major #2)
  - `.sisyphus/evidence/11-MIGRATE-password-hook.txt` 또는 `-password-reset.txt` — M-5c (a) 또는 (b) 경로 evidence (Oracle R-final Major #3)
- **REPRODUCE**: `cd maeil1dok-next/scripts/migrate && npx tsx run-migration.ts --dry-run`
- **ASSERTION**:
  - row count delta: 0% for all critical tables (profiles, user_progress, plan_subscriptions, daily_schedules)
  - FK orphan count: 0
  - 멱등성: 2회 run row count delta = 0
  - 사용자 매핑: 활성 사용자 100%

<!-- plan-checksum: PENDING -->
