# 11-FOUND · Foundation 복구

> **슬라이스 ID**: 11-FOUND  
> **Wave**: 0 (직렬, 모든 후속 작업의 토대)  
> **의존**: 없음  
> **추정 크기**: S  
> **상태**: 스켈레톤 — 02/04 인벤토리 도착 무관, 본 슬라이스는 인프라 복구라 즉시 작성 가능

---

## 1. 목표

마이그레이션 작업을 다시 시작하기 전에, 멈춰 있는 빌드/환경/git 상태를 **검증 가능한 그린 상태**로 복구한다. 이게 안 되면 후속 슬라이스 전부가 모래 위에 짓는 것.

---

## 2. 현재 상태 (증거 기반)

| 항목 | 증거 | 상태 |
|---|---|---|
| Next 빌드 | [build.log](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/build.log): `Type error: Property 'missedCount' is missing` | ❌ FAIL |
| TS 에러 | 02-next-inventory.md (배경 작업): 5건 (BibleSettingsContent.tsx, FontSection.tsx, PlanPageClient.tsx, ModalRegistry.ts) | ❌ 5건 |
| Vitest | 02 배경: 46개 중 42 pass / 4 fail | ⚠️ 4 fail |
| node_modules | `next: command not found` | ❌ 부재 |
| WIP 커밋 | `e5269db WIP(backend): update 24 files` (main 직접 푸시) | ⚠️ 정리 필요 |
| Untracked | `.omo/` (작업 산출물) | ⚠️ |
| .gitignore | `scripts/migrate/data/` (민감 데이터) | ⚠️ 검증 필요 |

---

## 3. 작업 항목 (atomic 단위)

### 3.1 환경 복구

| # | 작업 | 파일 | DoD |
|---|---|---|---|
| F-1 | maeil1dok-next/ 의존성 설치 | (package.json) | `npm install` exit 0 + node_modules 존재 |
| F-2 | scripts/migrate/ 의존성 설치 | scripts/migrate/package.json | 동일 |
| F-3 | `.env.local` 존재 + 키 검증 | .env.local | 02 인벤토리 §12 의 필수 키 모두 존재 |

### 3.2 빌드 그린

| # | 작업 | 파일 | DoD |
|---|---|---|---|
| F-4 | TS 에러 5건 수정 — 1건당 1 PR 또는 1 commit | BibleSettingsContent.tsx, FontSection.tsx, PlanPageClient.tsx, ModalRegistry.ts | `npx tsc --noEmit` exit 0 |
| F-5 | `npm run build` 통과 | (전체) | exit 0 + `.next/` 생성 |
| F-6 | 런타임 스모크 — `npm start` 후 `/`, `/login`, `/maintenance` GET 200 | (런타임) | curl 3건 모두 200 (또는 의도된 302) |

### 3.3 테스트 그린

| # | 작업 | 파일 | DoD |
|---|---|---|---|
| F-7 | Vitest 4건 fail 원인 진단 (수정 vs 의도된 skip 결정) | 02 §11 의 4건 | exit 0 또는 명시적 .skip + 사유 주석 |

### 3.4 git 상태 정리

| # | 작업 | DoD |
|---|---|---|
| F-8 | WIP 커밋 e5269db 분석 — Nuxt 변경 vs Next 변경 분리 | `git show e5269db --stat` 분석 보고서 |
| F-9 | WIP의 frontend/ (Nuxt) 부분 처리 결정 (유지 / 폐기) | 사용자 결정 |
| F-10 | WIP의 maeil1dok-next/ 부분 — 의미 있는 단위로 재커밋 또는 폐기 결정 | 사용자 결정 |
| F-11 | `.omo/` 작업 산출물 보존 (gitignore 확인 또는 별도 archive) | `.omo/`가 .gitignore에 있거나 명시적 보존 결정 |
| F-12 | pre-push hook 도입 — `WIP` prefix 차단 (00-meta-system §2.6) | hook 동작 검증 (테스트 WIP 푸시 시도 → 차단) |

### 3.5 메타 시스템 자동화

| # | 작업 | DoD |
|---|---|---|
| F-13 | placeholder 텍스트 grep CI 추가 — "구현 예정", "TODO production" 검출 시 CI fail | CI workflow 파일 + 의도적 테스트 푸시로 검증 |
| F-14 | Plan-checksum 동기화 스크립트 — docs/migration-v2/10-plan-overview.md + 11-*.md 변경 시 메타 갱신 | 스크립트 + npm run plan-sync |

---

## 4. 사용자 결정 필요 사항

| 결정 | 옵션 |
|---|---|
| FD-1 | Vitest 4개 fail: 수정 vs 의도된 skip vs 삭제 |
| FD-2 | WIP 커밋 e5269db: 분리 / 일부 cherry-pick / 폐기 |
| FD-3 | Nuxt frontend/ 의 5월 작업: 유지보수 트랙으로 계속 / 동결 / 폐기 |
| FD-4 | `scripts/migrate/data/` (3월 추출된 사용자 데이터): 보관 / 삭제 |

---

## 5. 통과 기준 (Wave 1 진입 전제)

```
✅ npm run build (maeil1dok-next/): exit 0
✅ npx tsc --noEmit: 0 errors
✅ npx vitest run: 0 fail (또는 명시적 skip)
✅ git status: clean (또는 사용자 OK된 상태)
✅ git log --oneline -1: WIP 아님
✅ pre-push hook: WIP prefix 차단 동작 확인
✅ /, /login, /maintenance: 런타임 200/302
```

---

## 6. 위험과 완화

| 위험 | 완화 |
|---|---|
| TS 에러 5건 수정이 깊은 리팩토링을 부른다 | 각 에러는 최소 수정 — 타입 보강 / 누락 prop 추가만. 함수 시그니처 변경 금지. |
| WIP 커밋 분리가 충돌을 일으킨다 | 별도 브랜치에서 시도 → 사용자 검토 후 main 적용 |
| Vitest fail이 실 버그를 가린다 | 4건 각각의 fail 메시지를 보고 "테스트 자체 문제"인지 "코드 문제"인지 분류 후 결정 |

---

## 7. DoD 통합 (00-meta-system §2.1 강제)

본 슬라이스 종료 시:

- **CHANGE**: `git log` 의 본 슬라이스 PR 목록
- **EVIDENCE**: `.sisyphus/evidence/11-FOUND-*.txt` (build/tsc/vitest 출력 + curl 결과)
- **REPRODUCE**: `cd maeil1dok-next && npm install && npm run build && npm test`
- **ASSERTION**:
  - TS errors: 0
  - Vitest fails: 0 (또는 N skipped, 사유 N개)
  - Build: PASS
  - Smoke: 3/3 routes responding

<!-- plan-checksum: PENDING -->
