# 00 · AI 실수 방지 시스템 (Meta-System)

> 본 마이그레이션은 AI 에이전트가 주도한다. **AI의 고질적 실수 패턴을 시스템 레벨에서 차단**하지 못하면 동일한 실패가 재발한다. 직전 Plan A~F는 이 시스템이 없어서 95% 데이터 손실, 인증 우회 스크린샷, placeholder 노출 등을 검출 못하고 통과시켰다.

---

## 1. 직전 시도에서 검출된 실패 패턴 (증거 기반)

| # | 패턴 | 증거 |
|---|---|---|
| F1 | **인증 우회 스크린샷을 "통과"로 처리** | [next-design-clone/issues.md](file:///Users/jgp/GitHub/maeil1dok/.omo/notepads/next-design-clone/issues.md): "Task 16: required evidence file ... is generated, but currently captures the auth-related server error page instead of the settings UI." |
| F2 | **VRT 설정 모순 미검출** | [design-polish/issues.md](file:///Users/jgp/GitHub/maeil1dok/.omo/notepads/design-polish/issues.md): "playwright.config.ts sets testMatch ... but also ignores that same file, so the configured dark VRT run never executes." → 한 번도 안 돌았음 |
| F3 | **VRT diff 35,407 픽셀 fail 무시** | 같은 파일: "home-light.png with 35407 diff pixels and stops the remaining serial light snapshots" |
| F4 | **데이터 95% 손실 silent skip** | [validation_report.json](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/scripts/migrate/data/validation_report.json): user_progress 7921→381. 매핑 안 된 사용자 데이터를 fail-soft로 warn만 남기고 통과 |
| F5 | **빌드 깨진 채로 종료** | [build.log](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/build.log): TS error on catchup/page.tsx, 빌드 fail 상태로 세션 종료 |
| F6 | **placeholder 프로덕션 노출** | [bible-renewal-qa-report.md](file:///Users/jgp/GitHub/maeil1dok/docs/bible-renewal-qa-report.md) BUG-005: "Task 3-3에서 구현 예정" 텍스트가 라이브에 노출 |
| F7 | **WIP 커밋 main에 직접 푸시** | git log: `e5269db WIP(backend): update 24 files` — 마이그레이션 트랙과 무관한 프론트 변경이 섞임 |
| F8 | **계획서 체크박스와 실 진척 불일치** | Plan F: 13 태스크 전부 `[ ]` 인데 산출물은 거의 다 존재 → "끝났는데 마킹 안 했나" vs "정말 미완" 구분 불가 |

---

## 2. 시스템 레벨 방지책

### 2.1 모든 산출물의 Definition of Done (DoD) 표준

작업이 완료됐다고 주장하려면 **다음 4가지가 함께 있어야** 한다. 하나라도 빠지면 incomplete.

```
[1] CHANGE: 어떤 파일을 어떻게 바꿨는가 (git diff 또는 신규 파일 목록)
[2] EVIDENCE: 동작 증거 - 명령 출력, 스크린샷, 로그, 또는 query 결과
[3] REPRODUCE: 같은 결과를 다시 만들 명령 1줄 (재현 가능성)
[4] ASSERTION: 합격 기준을 충족했음을 "측정 가능한" 형태로 (예: "TS errors: 0", "row count: 7921 == 7921", "playwright: 12/12 passed")
```

이 4개가 갖춰지지 않은 task는 PR/이슈 close 금지. GitHub Issue 템플릿에 박는다.

### 2.2 인벤토리·명세 단계 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **요약 표현 금지** — "기타", "etc.", "and so on", "그 외 다수", "...", "etc...", **"나머지", "그 외 항목들"** (Momus R1 Minor #1) 어떤 것도 grep으로 0건이어야 함 | 누락 은폐 |
| **enumeration 수치 검증 의무** (Momus R1 Minor #1) — 표/리스트의 행 수 = 실제 파일/엔티티 수가 본문에 수치로 명시되고, 검증 명령 (`ls / wc -l` 형식) 이 산출물 마지막 §검증 섹션에 박혀 있어야 함 | 부분 나열 (키워드 없는 중간 끊김) |
| **모든 주장에 file:line 인용** — "이 함수는 X를 한다"라 쓰면 옆에 `file.ts#L42-L58` 링크 의무 | 환각 |
| **추측 표현 금지** — "추정", "아마", "보임", "같다" 사용 시 옆에 "(unverified)" 태그 + 후속 확인 의무 | 추측의 사실화 |
| **빈 섹션도 명시** — 해당 항목이 0건이면 "0 items"라고 명시. 섹션 생략 금지 | 잊혀짐 |

### 2.3 Playwright 검증 강제 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **인증 라우트는 인증 주입 필수** — `(authenticated)` 그룹 라우트를 비로그인 상태에서 스크린샷 찍는 건 무효. evidence 파일에 인증 헤더/세션 stub 적용 흔적 의무 | F1 |
| **에러 페이지 검증** — 캡처한 스크린샷에 "An error occurred", "500", "Auth session missing", `error.tsx`의 흔적 grep → 검출 시 자동 fail | F1 |
| **VRT diff 0 픽셀이 기준값** — diff > 0 픽셀이면 명시적 baseline 갱신 커밋 또는 기능 fail. "35407 픽셀 차이"가 통과되는 일 금지 | F3 |
| **VRT baseline 갱신 인간 승인 의무** (Momus R1 Major #1) — `--update-snapshots` 로 baseline 을 덮어 쓰는 commit 은 PR 리뷰 필수, AI 자율 머지 금지. PR description 에 "이 변경은 의도된 시각 변화" 명시 의무. | F3 + AI 우회 |
| **playwright.config 자기 검증** — config의 testMatch와 ignore 패턴이 충돌 없는지 dry-run으로 검증 | F2 |

### 2.4 데이터 마이그레이션 검증 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **5% 손실 = hard fail** | F4 — fail-soft warn 금지 |
| **모든 unmapped user를 list로 출력** | silent skip 금지 — Django user_id + 사유 표 출력 |
| **재실행 멱등성 검증** — 두 번 돌려도 row count 동일 | daily_schedules +7행 같은 일 금지 |
| **샘플 5명 round-trip 검증** — Django에서 SELECT한 row를 Supabase에서 같은 user로 조회해 필드 단위 비교 | 매핑 정확성 |

### 2.5 빌드/타입/런타임 검증 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **세션 종료 전 빌드 그린 의무** — 빌드 fail 상태로 commit/push 금지 | F5 |
| **TS error 0건 baseline** — 임의 증가 시 PR 차단 | 누적 부채 |
| **TS 우회 패턴 금지** (Momus R1 Major #1) — `@ts-ignore`, `@ts-expect-error`, `as any`, `as unknown as X` 4종 모두 lint-staged + CI grep 으로 차단. `as unknown as X` 가 정당한 경우 (제네릭 한정 우회) 는 PR 에서 사용자 명시 승인 필요 | TS 그린 위장 |
| **service_role key 유출 차단** (Oracle R2 Major #5 + Oracle R-final Major #4 — 범위 확장) — 다음 모든 경로를 CI hard fail 로 차단: (1) **env 이름 grep** — `NEXT_PUBLIC_.*SERVICE_ROLE_KEY`, `NEXT_PUBLIC_.*SECRET`, `NEXT_PUBLIC_.*PRIVATE_KEY`. (2) **server-only import 강제** — `src/lib/supabase/server-admin.ts` (service_role client) 는 파일 최상단에 `import 'server-only';` 의무 + ESLint custom rule `no-service-role-in-client` (client component `'use client'` 또는 `src/app/**/page.tsx` 와 service-role 모듈 import 동시 발견 시 fail). (3) **client bundle / sourcemap secret scan** — `npm run build` 후 `.next/static/**/*.js` 와 `.next/static/**/*.js.map` 에 service_role key 패턴 (SUPABASE_SERVICE_ROLE_KEY 의 실제 값 첫 12자 또는 `eyJhbGc...` JWT 풀 패턴) grep 검출 시 fail. (4) **route log redaction** — `console.log` / `console.error` 인자에 service_role client 또는 `supabase.auth.admin` 응답 객체 직접 logging 차단 (ESLint custom rule). (5) **issue body sanitizer** — `scripts/migrate-v2/sync-issues.sh` 가 GH issue body 전송 전 service_role / JWT 패턴 grep → 검출 시 sync 중단. PUBLIC 저장소이므로 issue body 도 secret leak 경로 | 전체 DB 읽기/쓰기 권한 클라이언트 노출 (5 경로 모두 차단) |
| **런타임 스모크** — `npm run build` 통과만으로는 부족, 핵심 라우트 3개 GET 200 확인 | 빌드 그린 ≠ 동작 |

### 2.6 스코프·드리프트 방지 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **Plan 체크섬** — 각 플랜 파일에 sha256 첫 8자 메타로 박고, 실제 diff와 플랜 항목을 1:1 매핑 검증 | 스코프 크립 |
| **PR diff vs 플랜 매핑표** — 모든 PR description에 "이 PR이 다루는 플랜 항목" 명시 | 무관 변경 섞임 |
| **WIP 커밋 main 푸시 금지** — pre-push hook으로 `WIP` 프리픽스 차단 | F7 |
| **placeholder 텍스트 grep** — "구현 예정", "Task X-Y", "TODO", "FIXME"가 production 빌드에 포함되면 fail | F6 |

### 2.7 진행 추적 규칙

| 규칙 | 차단하는 실수 |
|---|---|
| **체크박스 ≡ GitHub Issue 상태** — 플랜 문서의 `[x]`는 GitHub Issue가 closed일 때만 허용 | F8 |
| **자동 동기화 스크립트** — 매일 또는 PR 머지 시 둘 사이 불일치 보고 | drift |

### 2.8 다중 세션 충돌 방지

| 규칙 | 차단하는 실수 |
|---|---|
| **Wave별 파일 ownership 표** — 각 작업이 어떤 파일을 만지는지 사전 선언 | 동시 편집 충돌 |
| **Untracked 파일 보호** — 다른 세션이 만든 파일을 자동 정리하지 않음 (사용자 instruction 반영) | 작업 손실 |

---

## 3. 본 세션에서 적용하는 즉시 적용 규칙

### 3.1 인벤토리 산출물 검증 자동 체크리스트

인벤토리 4건이 도착하면 본 세션이 즉시 검증:

```bash
# 누락 표현 검출
for f in 01-nuxt-inventory.md 02-next-inventory.md 03-backend-inventory.md 04-production-live-audit.md; do
  cd /Users/jgp/GitHub/maeil1dok/docs/migration-v2
  grep -nE "기타 등등|etc\.|and so on|그 외 다수|\.\.\.\s*$" "$f" && echo "FAIL: $f"
done

# 표 행수 ≡ 실제 파일 수 검증 (인벤토리 명세서가 자기검증 포함)
```

### 3.2 사용자 직감 반영 슬롯

`06-quality-scorecard.md` 에는 다음을 **사용자가 직접 채우는 빈 슬롯**을 둔다:
- "직감으로 가장 신뢰 안 가는 기능 Top 5"
- "마이그레이션 중 가장 두려운 영역"
- "절대 잃으면 안 되는 데이터·UX"

AI가 임의로 채우지 않는다.

### 3.3 Gate 통과 선언 규칙

다음 Gate로 넘어가려면 본 세션이:
1. 검증 체크리스트 실행 결과를 사용자에게 제시
2. 사용자에게 "Gate X 통과해도 됩니까?" 질문
3. **사용자 명시 OK** 후에만 다음 Gate 진입

AI가 자율로 Gate를 통과 선언하지 않는다.

---

## 4. 본 시스템 자체의 신뢰성

본 문서가 메타-방지 시스템인데, 본 문서 자체가 적당히 쓰여 있으면 본문도 신뢰 못 한다. 그래서:

- 본 시스템의 모든 규칙은 **직전 시도의 구체적 실패 증거**에 1:1 대응됨 (섹션 1 표의 F1~F8)
- 새로운 실패 패턴이 발견될 때마다 본 문서에 추가 (라이브 문서)
- 시스템이 무력화되는 경우(예: 사용자가 "그냥 진행해" 라고 하는 경우)도 명시:
  - **무력화 허용 조건**: 사용자가 명시적으로 "이 규칙은 이 작업에 한해 생략" 이라 말한 경우만
  - **무력화 자동 적용 금지**

---

## 5. GitHub Issue 템플릿 (40 단계에서 사용 예정)

```markdown
## 작업 항목 (Plan 11-XX-Y)

**플랜**: docs/migration-v2/11-{slice}.md#L{lineno}
**Wave**: N
**의존 이슈**: #X, #Y

### DoD (Definition of Done) — 모두 체크되어야 close
- [ ] CHANGE 명시: <git diff 또는 신규 파일 목록>
- [ ] EVIDENCE 제출: <스크린샷/로그/쿼리 결과 파일 경로>
- [ ] REPRODUCE 명령: `<재현 명령 1줄>`
- [ ] ASSERTION 측정값: <"TS errors: 0", "row count: N == N" 등>

### 차단 사항 (Must NOT)
- 무관 파일 수정 금지
- placeholder 텍스트 production 포함 금지  
- 인증 우회 스크린샷으로 통과 처리 금지

### 검증 명령
```
<실행할 명령>
```

### Linked PR
(PR 머지 시 close)
```

---

본 시스템은 이번 세션의 출력물 전체에 강제 적용된다.
