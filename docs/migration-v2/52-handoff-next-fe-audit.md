# 52 · Handoff — Next.js Frontend 완성도 감사 (FE Completion Audit)

> **목적**: `maeil1dok-next/` 프로젝트의 현 완성도를 객관적·증거 기반으로 측정해 Gate H (실 코드 작업) 진입 후 첫 우선순위를 결정한다.
> **기준 시점**: 2026-05-28 (본 핸드오프 작성 시점)
> **선행 핸드오프**: [50-handoff-verification-loop.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/50-handoff-verification-loop.md) (v2 plan 검증) → [27-handoff-rerun-critique.md](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/27-handoff-rerun-critique.md) (APPROVE 받음)
> **트리거 prompt**: 본 문서 §8 참조.

---

## 0. 한 줄 요약 (세션 시작 전 인지)

> "v2 plan 청사진은 Oracle APPROVE 받았다. 이제 **현 Next.js 코드가 그 청사진의 어디까지 와 있는지** 객관 측정 → 첫 코드 세션 시작 우선순위 결정 근거 마련."

---

## 1. 현재 자산 (감사 대상)

### 1.1 코드 (`maeil1dok-next/`)

| 항목 | 수치 (직전 인벤토리 기준) |
|---|---|
| page.tsx | **35** (`find src/app -name page.tsx` 실측) |
| API route.ts | **33** (`find src/app/api -name route.ts`) |
| components/*.tsx | **102** (`find src/components -name '*.tsx'`) |
| 총 .tsx + .ts | **338** |
| Next.js | 15.5.12 |
| 사용 스크립트 | `next dev` / `next build` / `next start` / `eslint src/` / `playwright test` / `vitest run` |

### 1.2 알려진 결함 (직전 세션 측정)

| 영역 | 상태 |
|---|---|
| `npm run build` | ❌ **FAIL** — `src/app/(authenticated)/catchup/page.tsx:154` TypeScript `missedCount` prop 누락 (직전 build.log 증거) |
| `npx tsc --noEmit` | ❌ **5건** — BibleSettingsContent, FontSection, PlanPageClient, ModalRegistry, CatchupClient |
| `npx vitest run` | ⚠️ **4건 fail** (46개 중 42 pass) |
| `node_modules/` | ❓ 직전 세션 부재 (`next: command not found` 발생) — 재확인 의무 |
| WIP 커밋 | ⚠️ `e5269db WIP(backend): update 24 files` main 푸시됨 (정리 미완) |

### 1.3 SSOT 참조 문서

| 문서 | 역할 |
|---|---|
| [`02-next-inventory.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/02-next-inventory.md) | 35 page / 33 API / 111 component 전수 (직전 작성) |
| [`05-feature-matrix.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/05-feature-matrix.md) | PARITY 27 / MISSING 17 / OBSOLETE 9 / DEFER 6 / NEW 11 (직전 합성) |
| [`04-production-live-audit.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/04-production-live-audit.md) | 라이브 사이트 BUG 단정 (BUG-001 false positive / BUG-003/004 REPRODUCED / BUG-005 해결 / **BUG-006 신규 발견** — `/bible/highlights` 로그인 사용자 null TypeError 크래시) |
| [`11-FOUND.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/11-FOUND.md) | F-1~F-17 Foundation 복구 작업 (TS 에러 5건 fix 의무 포함) |
| [`CLAUDE.md`](file:///Users/jgp/GitHub/maeil1dok/CLAUDE.md) | UI 디자인 시스템 가이드 (Modal SSOT) |

### 1.4 디자인 시스템 SSOT

`maeil1dok-next/src/components/ui/` 가 atom layer. CLAUDE.md 의 Modal 통합 시스템 (`useModal()` composable + ModalHost) 이 명시되어 있음. 다른 atom (Button, Card, Badge, Container, Input 등) 도 동일 패턴 추정 — 실 확인 의무.

### 1.5 라이브 사이트 직전 검증 evidence (27-handoff §3)

| BUG | 단정 |
|---|---|
| BUG-001 (성경 본문 미표시) | NOT reproduced (Webfetch false positive) |
| BUG-003 (콘솔 에러) | REPRODUCED (Nuxt SSR hydration mismatch) |
| BUG-004 (책장 URL undefined) | REPRODUCED (URL param 없음) |
| BUG-005 (Task 3-3 placeholder) | 해결됨 (placeholder 0 hits) |
| **BUG-006 (신규)** | REPRODUCED (`/bible/highlights` 로그인 사용자 한정 JS null TypeError 크래시 → 빈 페이지) |
| T0004 (리더보드 뒤로가기 500) | 10/50 사이클 NOT reproduced (부분) |

> **주의**: 위 BUG 검증은 **라이브 운영 사이트 (현재 Nuxt+Django, maeil1dok.app)** 에서 한 것. 본 감사 대상인 **Next.js 측 (maeil1dok-next/) 은 아직 라이브 미배포** 상태. Next.js 의 동작은 `npm run dev` 또는 `npm start` 로 로컬에서만 확인 가능.

---

## 2. 감사 동기 (Why now)

### 2.1 직전 v2 plan 검증 완료 직후 시점

Oracle R-rerun-final-3 APPROVE (92%) + Momus 3차례 5/5 게이트 통과 + 자가 검증 126 PASS / 0 FAIL + 라이브 BUG 단정 완료. **plan 청사진은 통과**.

### 2.2 그러나 청사진과 실 코드 사이 간격 미측정

- v2 plan 의 Wave 0 (11-FOUND) 작업이 "빌드 그린 + TS 에러 5건 fix + WIP 정리" 인데 — **얼마나 많이 깨져 있는지 객관 수치 없음**.
- v2 plan 의 Wave 3 (11-READER R-1~R-15) 작업이 "현 Next /bible 페이지 → 슬림화 + URL fix" 인데 — **현 페이지가 얼마나 완성된 상태인지 미측정**.
- 디자인 시스템 atom (`components/ui/*`) 이 모든 페이지에서 일관 사용되는지 미측정.
- placeholder / TODO / FIXME / `as any` / `console.log` 등 production 미준비 흔적 미측정.

### 2.3 첫 코드 세션 진입 직전 의사결정 필요

- Wave 1 (MIGRATE) 부터 시작할지 vs Wave 0 (FOUND) 의 정리 작업이 예상보다 큼 → Wave 0 먼저 끝낼지
- Re-use 가능한 page/component vs 재작성 필요한 page/component 비율
- 디자인 시스템 마이그레이션 SSOT 시점 (지금 vs 컷오버 후)

---

## 3. 감사 단계 (Phase 1 ~ Phase 7)

### Phase 1 — 정적 분석 (read-only, 인증 무관)

#### 1.1 빌드 상태

```bash
cd maeil1dok-next
npm install                  # node_modules 없으면 재설치
npm run build 2>&1 | tee /tmp/next-audit/build.log
echo "exit: $?"
```

기록: build pass/fail + 에러 라인 전수 + 빌드 시간 + 빌드 산출물 (.next/) 크기

#### 1.2 TypeScript

```bash
npx tsc --noEmit 2>&1 | tee /tmp/next-audit/tsc.log
```

기록: 에러 갯수 + 파일별 분포 + 에러 유형 분류 (missing prop / type mismatch / never / any leak / 기타)

#### 1.3 Lint

```bash
npm run lint 2>&1 | tee /tmp/next-audit/lint.log
```

기록: errors + warnings 갯수 + 패턴 (react-hooks rules, unused-vars, exhaustive-deps, no-explicit-any 등)

#### 1.4 Unit test

```bash
npx vitest run 2>&1 | tee /tmp/next-audit/vitest.log
```

기록: 통과/실패 (직전 4건 fail) + 각 fail 의 root cause 분류

#### 1.5 E2E test 인벤토리 (실행 미의무)

```bash
ls tests/e2e/ 2>/dev/null
find tests -name '*.spec.ts' | wc -l
```

기록: 작성된 e2e 갯수 + 커버 라우트 + Playwright config 의 testMatch/ignore 충돌 여부 (F2 회귀)

### Phase 2 — 코드 자산 매트릭스 (read-only, 인증 무관)

35 page × 33 API × 102 component 의 **각 항목 완성도** 측정:

#### 2.1 page.tsx 매트릭스

각 35 페이지에 대해:

| 컬럼 | 측정 |
|---|---|
| 라인 수 | `wc -l` |
| use client / use server | grep |
| repository import | grep `src/repositories/` |
| hooks 사용 | grep `'use'` import |
| store (zustand/jotai) 사용 | grep |
| TS 에러 발생 여부 | tsc.log 매칭 |
| TODO/FIXME/placeholder | grep `TODO\|FIXME\|구현 예정\|Task ` |
| `as any` / `@ts-ignore` 등 우회 | grep |

출력: 35행 표

#### 2.2 API route.ts 매트릭스

각 33 API 에 대해:

| 컬럼 | 측정 |
|---|---|
| HTTP 메서드 (GET/POST/PUT/DELETE) | export 함수명 grep |
| Supabase service-role 사용 여부 | import 'server-only' 및 admin client 사용 |
| Django proxy 여부 | `api.maeil1dok.app` URL 검출 |
| 에러 핸들링 | try/catch 블록 존재 + NextResponse error 응답 |
| auth 가드 | session check 패턴 |

#### 2.3 components 매트릭스

102 컴포넌트 분류:

| 분류 | 측정 |
|---|---|
| atom (`components/ui/*`) | 갯수 + 종류 (Button / Card / Modal / Badge / Container / Input / 등) |
| feature (`components/{feature}/*`) | 영역별 (bible / hasena / catchup / 등) |
| page-specific (`page/_components/` 또는 `_shared/`) | 페이지 종속 |
| 라인 수 분포 | 50/100/200/500+ 분포 |

#### 2.4 디자인 시스템 일관성 (핵심)

CLAUDE.md 의 Modal 통합 시스템 외 atom 들에 대해:

| 검사 | 측정 |
|---|---|
| atom 외 raw `<button>`, `<div className="bg-...">` 등 직접 작성 비율 | grep 패턴 |
| Tailwind 색상 토큰 (`bg-primary` 등) vs raw 색 (`bg-[#...]`) | 토큰 사용률 |
| 다크모드 대응 (`dark:` modifier) 적용도 | grep |
| 도메인 SSOT atom 존재 여부 (예: `LeaderLabel`) | CLAUDE.md 의 6번 룰 적용도 |

### Phase 3 — placeholder / 미완성 흔적 hunt (read-only)

```bash
# v2 plan 의 placeholder 룰 (00-meta §2.6)
grep -rE '구현 예정|Task [0-9]+-[0-9]+|TODO production|FIXME production' src/

# 디자인 placeholder
grep -rE 'TODO\|FIXME\|XXX\|HACK' src/

# 인증 우회
grep -rE 'as any\|@ts-ignore\|@ts-expect-error\|as unknown as' src/

# console.log production 누락
grep -rE 'console\.(log|debug|info)' src/ | grep -v test

# placeholder 이미지/텍스트
grep -rE 'lorem|ipsum|placeholder|Example' src/
```

기록: 각 패턴별 hit 갯수 + 상위 10건 파일:라인

### Phase 4 — 환경/인프라 (read-only, 인증 무관)

| 검사 | 측정 |
|---|---|
| `.env.local` 존재 + 필수 키 (02 §12) | exists + 키 카운트 (값은 grep 금지 — secret) |
| `next.config.ts` | 옵션 (turbopack, eslint, typescript, images 등) |
| `tsconfig.json` | strict mode / paths / exclude |
| `vercel.json` | 배포 설정 |
| `supabase/` | migrations 갯수 + RLS 정책 갯수 |
| `playwright.config.ts` | testMatch vs ignore 충돌 (F2) |

### Phase 5 — 로컬 런타임 검증 (Playwright, 사용자 로그인 필요)

#### 5.1 dev 서버 기동

```bash
cd maeil1dok-next
npm run dev &  # PID 기록
sleep 10
curl -I http://localhost:3000  # 200 확인
```

#### 5.2 page 순회 (35개)

Playwright headed Chrome 으로 35 page 모두 순회:

| 페이지 별 측정 | 항목 |
|---|---|
| HTTP status | 200 / 302 / 404 / 500 |
| 콘솔 에러 갯수 | console.on('error') |
| 네트워크 4xx/5xx 갯수 | page.on('response') |
| 빈 페이지 여부 | snapshot 라인 수 ≤ 5 이면 의심 |
| placeholder 텍스트 노출 | "구현 예정" 등 grep |
| 인증 가드 동작 | (authenticated)/* 비로그인 시 /login 리다이렉트 |

**사용자 로그인 후** (Supabase 측 — 본 감사 시점에 사용자 계정 사전 등록 필요):
- (authenticated)/* 11개 라우트 순회
- BUG-006 같은 신 결함 검출

#### 5.3 다크모드 / 모바일 viewport

- 다크모드 토글 → 35 page 시각 비교 (스크린샷 2N 장)
- 모바일 viewport (375×667) vs 데스크탑 (1280×800) — 반응형 회귀 검출

#### 5.4 인터랙션 회귀 검출

| 인터랙션 | 시나리오 |
|---|---|
| 책 선택 → URL 변화 | BUG-004 회귀 (Nuxt 에서 발견된 결함이 Next 측에도 있는지) |
| 형광펜 페이지 | BUG-006 (Nuxt 결함이 Next 에도) — Next 측 `_nuxt/C120IKHY.js` 와 동일 패턴 여부 |
| 모달 열기/닫기 | CLAUDE.md 통합 모달 SSOT 사용 검증 |
| 다크모드 토글 | 모든 페이지 즉시 반영 |

### Phase 6 — 결과 종합 + 05-feature-matrix.md 갱신

#### 6.1 PARITY/MISSING/REGRESSION/NEW 라벨 갱신

05-feature-matrix.md 의 27 PARITY 행 각각에 대해:
- 본 감사 결과 PARITY 유지 → ✅
- 깨진 부분 발견 → **REGRESSION** 으로 라벨 변경 + 사유 명시
- 신 BUG 발견 → BUG-xxx 신설

#### 6.2 슬라이스별 작업 추정

각 11-*.md 슬라이스에 대해:
- 이미 완성된 부분 (재사용 가능) %
- 부분 완성 (수정 필요) %
- 미완성 (재작성 또는 신규 작성) %

#### 6.3 Wave 0 (FOUND) 작업 정밀 견적

- F-1 (npm install): 분 단위
- F-4 (TS 에러 5건): 각 에러별 fix 난이도 + 라인 수 추정
- F-5 (build pass): 종합 시간
- F-7 (vitest 4건 fail): 각각 진단
- F-8~F-12 (WIP 정리 + git): 사용자 결정 필요 항목 추출

### Phase 7 — 최종 보고서 작성

**출력 파일**: [`docs/migration-v2/28-next-fe-completion-report.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/28-next-fe-completion-report.md)

구조:
- §0 한 줄 verdict (READY / PARTIAL / BROKEN 등 등급)
- §1 정적 분석 결과 (build/TS/lint/test)
- §2 코드 자산 매트릭스 (page/API/component)
- §3 디자인 시스템 적용도
- §4 미완성 흔적
- §5 라이브 런타임 검증 (로컬 dev) + 사용자 로그인 후 결과
- §6 05-feature-matrix.md 와 대조 결과
- §7 Wave 0 (FOUND) 정밀 견적
- §8 다음 단계 사용자 결정 항목
- §9 신뢰성 보장 (재현 명령 + evidence 파일 경로)

---

## 4. 출력 사양 (필수 형식)

### 4.1 신규 파일

`docs/migration-v2/28-next-fe-completion-report.md` (본 감사 산출물)

### 4.2 갱신 파일 (수정 허용)

- `docs/migration-v2/05-feature-matrix.md` — 본 감사 결과 PARITY → REGRESSION 변경 등 라벨 갱신
- `docs/migration-v2/02-next-inventory.md` — 직전 인벤토리와 실 코드 차이 검출 시 갱신 (예: page 갯수 변경)

### 4.3 evidence 디렉토리

`.sisyphus/evidence/next-fe-audit/`:
- `build.log` / `tsc.log` / `lint.log` / `vitest.log`
- `routes-walk-{page-id}-{light|dark}-{mobile|desktop}.png` (최대 280장 = 35 × 2 × 2 × 2 단순화)
- `console-{page-id}.log`
- `network-{page-id}.log`
- `code-matrix.json` (Phase 2 의 35+33+102 행 매트릭스)

### 4.4 수정 금지 영역

- `maeil1dok-next/src/**/*.ts` / `*.tsx` (코드 수정 금지 — 본 감사는 read-only)
- `docs/migration-v2/00-meta-system.md` (메타 룰)
- `docs/migration-v2/10-plan-overview.md` 및 11-*.md (Oracle APPROVE 받은 plan)
- `scripts/migrate-v2/*` (자동화 스크립트)
- `.env*` (secret)
- git commit/push 일체 금지 (사용자 명시 요청 후만)

---

## 5. 성공 기준

다음 모두 충족 시 "감사 완료" 선언 가능:

- [ ] `npm run build` 실 실행 + 결과 단정
- [ ] `npx tsc --noEmit` 실 실행 + 에러 갯수 단정
- [ ] `npm run lint` 실 실행 + 결과 단정
- [ ] `npx vitest run` 실 실행 + 결과 단정
- [ ] 35 page × 평균 100 라인 코드 매트릭스 작성 완료
- [ ] 33 API route 매트릭스 작성 완료
- [ ] 102 component 매트릭스 작성 완료
- [ ] 디자인 시스템 일관성 측정 (atom 사용률 % 단정)
- [ ] placeholder / TODO / FIXME / TS 우회 패턴 모두 검출 + 갯수 단정
- [ ] 로컬 dev 서버 35 page 모두 순회 (사용자 로그인 후 인증 라우트 포함)
- [ ] BUG-001/003/004/005/006/T0004 가 Next 측에도 있는지 검증 (Nuxt 결함 회귀 여부)
- [ ] `28-next-fe-completion-report.md` 작성 완료 + §0 verdict 등급 부여
- [ ] 사용자에게 verdict + Wave 0 정밀 견적 + 다음 단계 결정 요청

---

## 6. 메타 시스템 규칙 (반드시 준수)

[`00-meta-system.md`](file:///Users/jgp/GitHub/maeil1dok/docs/migration-v2/00-meta-system.md) 의 8 카테고리 + 본 핸드오프 강조:

1. **추측 금지** — 모든 수치/주장은 명령 출력 또는 파일 grep 결과 인용 의무 (`build.log:42` 식).
2. **요약 표현 금지** — "기타", "etc.", "그 외", "나머지" 모두 grep 0 hits 의무.
3. **인증 우회 검증 무효** — Playwright `(authenticated)/*` 라우트는 사용자 본인 로그인 evidence 의무.
4. **TS 우회 패턴 grep** — `@ts-ignore` / `@ts-expect-error` / `as any` / `as unknown as X` 4종 갯수 보고.
5. **placeholder grep** — "구현 예정" / "Task X-Y" / "TODO production" 검출.
6. **본 감사 자체의 false-clean 차단** — 자가 "통과" 선언 시 명령 재실행 결과를 evidence 로 첨부 (다른 검증 도구가 검증 가능하도록).

---

## 7. 사용자 결정 필요 영역 (감사 진행 중 또는 후)

| 영역 | 결정 |
|---|---|
| `node_modules/` 재설치 시 디스크 사용 (수 GB) | OK / 보류 |
| 로컬 dev 서버 실행 (배경 프로세스 점유) | OK / 다른 모드 |
| Playwright 사용자 본인 로그인 (브라우저 띄움) | OK / 비로그인만 / 별도 세션 |
| Phase 6 의 05-feature-matrix.md 갱신 | 자동 적용 / dry-run + 사용자 검토 후 |
| Phase 7 의 28-* 보고서 commit | 사용자 명시 요청 후만 |

---

## 8. 트리거 prompt (새 세션에서 복붙)

```
매일일독 Next.js Frontend 완성도 감사 진행.

핸드오프 문서: /Users/jgp/GitHub/maeil1dok/docs/migration-v2/52-handoff-next-fe-audit.md

이 파일을 먼저 Read 한 뒤, §3 Phase 1 ~ Phase 7 순서로 진행:

Phase 1: 정적 분석 (npm run build / tsc / lint / vitest)
Phase 2: 35 page × 33 API × 102 component 매트릭스
Phase 3: placeholder / TODO / FIXME / TS 우회 패턴 hunt
Phase 4: 환경/인프라 (.env / next.config / tsconfig / supabase)
Phase 5: 로컬 dev 서버 + Playwright 라이브 런타임 검증 (사용자 로그인 필요)
Phase 6: 05-feature-matrix.md 와 대조 + REGRESSION 라벨 갱신
Phase 7: docs/migration-v2/28-next-fe-completion-report.md 작성

성공 기준:
- 4 정적 도구 실 실행 결과 단정
- 코드 자산 35+33+102 매트릭스 완성
- 라이브 35 page 순회 + 콘솔/네트워크 에러 수집
- BUG-001/003/004/005/006/T0004 의 Next 측 재현 여부 단정
- §0 verdict 등급 + Wave 0 정밀 견적 + 다음 단계 결정 요청

규칙:
- maeil1dok-next/ 코드 수정 금지 (read-only 감사)
- placeholder / TS 우회 / console.log production 모두 grep 의무
- 모든 수치는 명령 출력 인용 의무 (추측 금지)
- 사용자 로그인 (브라우저 띄울 때) 직전에 본인 결정 요청
- 28-* 보고서 commit 사용자 명시 요청 후만
- 본 감사가 v2 plan (Oracle APPROVE 받은 청사진) 의 11-*.md 슬라이스를 수정하지 않음

PRE 결정 (재논의 금지):
- v2 plan 자체는 Oracle R-rerun-final-3 APPROVE (92%) 받음 (27-handoff §0 참조)
- 본 감사는 plan 검증이 아니라 실 코드 상태 측정
- Gate H 진입 결정 (실 코드 작업 시작) 은 본 감사 결과 + 사용자 승인 후

진행 시작.
```

---

## 9. 본 핸드오프의 신뢰성

본 핸드오프 작성자 (Claude Opus 4.7) 의 시각 — 새 세션이 검증 의무:

- "직전 빌드 build.log 의 missedCount TS 에러" — 본 감사 시 재실행 시 동일한지 확인
- "page 35 / API 33 / component 102 갯수" — 재측정 의무 (직전 측정 후 변경 가능)
- "BUG-006 (highlights null TypeError) 는 Nuxt 측 발견" — Next 측에 같은 결함 있는지 명시 검증 의무
- "5 TS 에러" — 본 감사 시점에 변경되었을 수 있음. 실측만 신뢰.

---

## 10. 완료 신호

새 세션이 다음 모두 충족 시 "FE 완성도 감사 완료" 선언 가능:

- [ ] §5 모든 성공 기준 충족
- [ ] 신규 파일 `28-next-fe-completion-report.md` 작성 완료
- [ ] §0 한 줄 verdict 등급 (READY / PARTIAL / BROKEN 등)
- [ ] 갱신된 `05-feature-matrix.md` / `02-next-inventory.md` (필요 시)
- [ ] evidence 디렉토리 `.sisyphus/evidence/next-fe-audit/` 완비
- [ ] 사용자에게 verdict + 다음 단계 (Gate H 진입 우선순위) 결정 요청

<!-- handoff-version: 1 -->
<!-- handoff-date: 2026-05-28 -->
<!-- target-session: Next.js FE 완성도 객관 감사 -->
