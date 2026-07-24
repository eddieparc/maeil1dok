# Migration v2 — Nuxt에서 Next.js로 전환

`maeil1dok-next/` 전환 계획과 검증 기준을 관리합니다. v2는 아직 배포되지 않았으며 현재 프로덕션은 Django + Nuxt입니다.

## 진실 공급원 우선순위

1. v1 운영 사실: `AGENTS.md`, `DEPLOY.md`, 프로덕션 코드
2. v2 구현 동작: `maeil1dok-next/` 코드와 테스트
3. v2 계획 의도: 이 디렉토리의 활성 문서
4. 과거 검토 기록: `archive/` — 참고 자료이며 현재 SSOT가 아님

문서와 코드가 충돌하면 실제 동작을 검증하고 활성 문서를 함께 갱신합니다.

## 활성 문서

| 문서 | 역할 |
|---|---|
| [`00-meta-system.md`](00-meta-system.md) | 변경·검증 원칙 |
| [`01-nuxt-inventory.md`](01-nuxt-inventory.md) | 기존 Nuxt 기능 스냅샷 |
| [`02-next-inventory.md`](02-next-inventory.md) | Next.js 구현 스냅샷 |
| [`03a-backend-api.md`](03a-backend-api.md), [`03b-backend-domain.md`](03b-backend-domain.md) | 백엔드 계약 |
| [`04-production-live-audit.md`](04-production-live-audit.md) | 프로덕션 관찰 기록 |
| [`05-feature-matrix.md`](05-feature-matrix.md) | 기능 전환 결정 |
| [`06-quality-scorecard.md`](06-quality-scorecard.md) | 위험도와 우선순위 |
| [`10-plan-overview.md`](10-plan-overview.md) | 실행 순서와 Wave |
| `11-*.md` | 기능별 실행·완료 조건 |
| [`40-github-mapping.md`](40-github-mapping.md) | Issue와 milestone 매핑 |

`archive/`에는 2026년 5월의 critique, review, handoff, completion report를 보관합니다. 새 구현 판단의 근거로 사용할 때는 현재 코드와 다시 대조해야 합니다.

## 핵심 안전 조건

- 데이터 마이그레이션은 손실 임계치를 넘으면 즉시 실패합니다.
- 인증·권한·RLS 검증 없이 parity 완료로 판정하지 않습니다.
- 빌드 성공만으로 완료 처리하지 않고 테스트와 런타임 스모크를 요구합니다.
- 스코프 변경은 기능 매트릭스와 실행 문서에 함께 반영합니다.
- 시크릿과 추출된 사용자 데이터는 저장소에 커밋하지 않습니다.

## 검증

```bash
bash scripts/migrate-v2/validate-plan.sh
bash scripts/migrate-v2/verify-milestones.sh
bash scripts/migrate-v2/verify-issues.sh
```

스크립트 사용법과 GitHub 동기화 절차는 [`scripts/migrate-v2/RUNBOOK.md`](../../scripts/migrate-v2/RUNBOOK.md)를 따릅니다.