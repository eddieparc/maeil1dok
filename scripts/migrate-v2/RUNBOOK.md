# Migration v2 — GitHub Issue/Milestone 생성 Runbook

> **트리거**: Gate F (Oracle 최종 리뷰) **PASS** 후만 실행.  
> **저장소**: `eddieparc/maeil1dok` (PUBLIC)

---

## 0. 사전 점검 (실행 5분 전)

```bash
cd /Users/jgp/GitHub/maeil1dok

# 1. plan validator PASS 확인
bash scripts/migrate-v2/validate-plan.sh                # 39 PASS / 0 FAIL 기대

# 2. catalog 최신 상태 — Momus R5 OKAY 시점 기준
python3 scripts/migrate-v2/extract-tasks.py
jq '. | {milestones: (.milestones | length), issues: (.issues | length)}' scripts/migrate-v2/catalog.json

# 3. gh 인증
gh auth status                                          # eddieparc 로 로그인 확인

# 4. 저장소 확인
gh repo view --json nameWithOwner,visibility            # eddieparc/maeil1dok PUBLIC
```

---

## 1. 실행 순서 (3 단계, 각 dry-run 먼저)

### 단계 1: 라벨 생성

```bash
# Dry-run
bash scripts/migrate-v2/01-create-labels.sh

# 실 적용
APPLY=1 bash scripts/migrate-v2/01-create-labels.sh
```

**기대값**: ~30 라벨 생성 (slice:* 15 + P0~P3 5 + gap:* 6 + type:* 7 + state:* 5 + decision/needs-review 2).

### 단계 2: 마일스톤 생성

```bash
# Dry-run
bash scripts/migrate-v2/02-create-milestones.sh

# 실 적용
APPLY=1 bash scripts/migrate-v2/02-create-milestones.sh
```

**기대값**: 16 milestone (15 slice + INFRA).

### 단계 3: 이슈 생성

```bash
# Dry-run
bash scripts/migrate-v2/03-create-issues.sh             # 179 issues preview

# 실 적용
APPLY=1 bash scripts/migrate-v2/03-create-issues.sh
```

**기대값**: 179 issue 생성. 슬라이스별 분포:
- CUTOVER 26 / AUTH 21 / DESIGN 19 / MIGRATE 17 / READER 15 / FOUND 14 / PROGRESS 12 / ANNOTATE 9 / PLAN 8 / SOCIAL 8 / ADMIN 8 / PWA 6 / CATCHUP 6 / HASENA 5 / PROFILE 5

⚠️ **Rate limit**: GH REST API 5,000 req/h. 179 이슈는 여유 (각 이슈당 1 req).

---

## 2. 사후 검증

```bash
# 라벨 카운트
gh label list --limit 50 | wc -l                        # 30+ 기대

# 마일스톤 카운트
gh api repos/{owner}/{repo}/milestones --jq '. | length' # 16 기대

# 이슈 카운트
gh issue list --limit 200 --state open | wc -l          # 179 기대

# 슬라이스별 분포 검증
for slice in FOUND AUTH MIGRATE DESIGN PWA READER PLAN ANNOTATE PROGRESS HASENA CATCHUP PROFILE SOCIAL ADMIN CUTOVER; do
    count=$(gh issue list --limit 200 --label "slice:$slice" --json title --jq '. | length')
    echo "slice:$slice → $count issues"
done
```

---

## 3. 롤백 (필요시)

이슈 일괄 close (생성 직후 잘못 만든 경우):

```bash
# 모든 v2 milestone 의 이슈를 close
for ms in $(gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title | startswith("v2/")) | .number'); do
    for issue in $(gh issue list --limit 200 --milestone "$ms" --json number --jq '.[].number'); do
        gh issue close "$issue" --reason "not planned"
    done
done
```

이슈 일괄 삭제 (영구):

```bash
# Owner 권한 필요. 신중히.
for issue in $(gh issue list --limit 200 --label "slice:FOUND" --json number --jq '.[].number'); do
    gh api "repos/{owner}/{repo}/issues/$issue" -X DELETE
done
```

---

## 4. 추적 동기화 (Gate G 완료 후)

### 4.1 플랜 ↔ Issue 양방향 링크

각 11-*.md 슬라이스 플랜의 작업 행에 GH Issue 링크 추가 (옵션):
```bash
# 예시 — 11-FOUND.md 의 F-1 행 옆에 (#5) 같은 링크
# 작성 스크립트는 별도 후속 작업.
```

### 4.2 Issue close 시 체크박스 자동 표시

GH Action 으로 issue close 이벤트 → 해당 11-*.md 의 체크박스 `[ ]` → `[x]` (옵션). 본 단계는 별도 후속 작업.

---

## 5. 보안 점검 (PUBLIC repo)

- Issue 본문에 다음 절대 포함 금지:
  - `.env*` 파일 내용
  - Supabase service_role key
  - Kakao/Google/Apple OAuth secret
  - DB 사용자 password
  - 사용자 PII (실 이메일, 닉네임, 사용자 ID 등)

- catalog.json 자체 점검:
```bash
# 비밀 패턴 grep
grep -E "(eyJ[a-zA-Z0-9_-]+\.|sk_live_|service_role_key|client_secret)" scripts/migrate-v2/catalog.json && echo "❌ 비밀 노출" || echo "✅ 비밀 grep 0"

# 실 이메일 grep
grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" scripts/migrate-v2/catalog.json | grep -v "example.com\|maeil1dok.app" || echo "✅ 실 이메일 grep 0"
```

---

## 6. 실 적용 후 첫 작업

1. `slice:FOUND` + `P0` 라벨 이슈 14개 — Wave 0 시작
2. 자가 검증 명령 모음 (`scripts/migrate-v2/validate-plan.sh`) 을 매 PR 머지 시 실행
3. 메타 시스템 (00-meta-system §2.5 TS 우회 lint, §2.6 placeholder grep CI) 를 가장 먼저 CI 에 추가

---

## 7. 비상 정지

작업 중 catalog 가 깨졌거나 wrong issue 가 대량 생성된 경우:

```bash
# 즉시 모든 issue close (오작동 표시)
gh issue list --limit 200 --json number,title,createdAt \
    --jq '.[] | select(.title | startswith("[v2-WRONG]")) | .number' \
    | xargs -I {} gh issue close {} --reason "not planned"
```

본 runbook 은 dry-run 통과 후만 APPLY=1 실행. 절대 dry-run 건너뛰지 말 것.
