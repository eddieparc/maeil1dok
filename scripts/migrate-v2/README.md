# scripts/migrate-v2/ — GitHub 추적 인프라

> **트리거 시점**: Gate F (Oracle 최종 리뷰) 통과 후만 실행.  
> **기준 문서**: [docs/migration-v2/40-github-mapping.md](../../docs/migration-v2/40-github-mapping.md)

---

## 사용 순서

1. **Dry-run 검토** (기본값):
   ```bash
   ./01-create-labels.sh
   ./02-create-milestones.sh
   ./03-create-issues.sh
   ```
   → 무엇이 만들어질지만 표시. 실 생성 X.

2. **실 적용**:
   ```bash
   APPLY=1 ./01-create-labels.sh
   APPLY=1 ./02-create-milestones.sh
   APPLY=1 ./03-create-issues.sh
   ```

3. **검증**:
   ```bash
   gh label list --limit 50
   gh api repos/{owner}/{repo}/milestones --jq '.[].title'
   gh issue list --limit 50
   ```

---

## 멱등성 보장

모든 스크립트는 idempotent:
- 라벨 존재 시 skip
- 마일스톤 존재 시 skip (제목 매칭)
- 이슈 존재 시 skip (제목 매칭 — 단, GH 는 제목 중복 허용하므로 라벨+밀스톤 조합으로 식별)

재실행 안전.

---

## 환경

- `gh` CLI v2.92+ 필수
- `gh auth status` 통과 필요
- 현재 인증 계정: `eddieparc`
- 저장소: `eddieparc/maeil1dok` (PUBLIC)

⚠️ **PUBLIC 저장소**: Issue 본문에 credentials / 사용자 PII / DB 비밀번호 절대 포함 금지. 본 스크립트는 docs/migration-v2/ 의 공개된 메타데이터만 사용.

---

## 파일

| 파일 | 역할 |
|---|---|
| `01-create-labels.sh` | 라벨 스킴 일괄 생성 (slice:* / P0~P3 / gap:* / type:* / state:*) |
| `02-create-milestones.sh` | 16개 milestone 일괄 생성 |
| `03-create-issues.sh` | catalog.json 기반 이슈 일괄 생성 |
| `catalog.json` | 단일 진실 — milestones + issues 메타데이터 |
| `lib/common.sh` | 공유 유틸 |

---

## 추적 동기화 (Gate G 이후)

GH Issue ↔ docs/migration-v2/ 플랜의 체크박스가 동기화 되도록 GH Action 후속 구축. 미구축 시 수동 동기화: Issue close 시 해당 11-*.md 의 작업 항목을 `[x]` 처리.
