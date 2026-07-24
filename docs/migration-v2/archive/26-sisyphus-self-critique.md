# 26 · Sisyphus Self-Critique (외부 모델 차단 우회 — Claude Opus 4.7)

## 상황
- 외부 Momus + Oracle 재크리틱이 OpenCode workspace credits 0 + Antigravity 3 계정 401 로 물리적 차단됨.
- 본 critique 는 외부 검증의 일시적 대체. 사용자 credits 충전 후 외부 재검증 권장.
- Claude Opus 4.7 시각 (sisyphus 본 세션) 의 적대적 정밀 검토.

---

## Verdict
**REJECT — 4 BLOCKING + 5 MAJOR + 9 MINOR**

이전 라운드가 잡지 못한 **Supabase API 실 동작 가정** 과 **plan 본문 내부 모순** 위주.

---

## BLOCKING (Wave 1 진입 전 반드시 fix)

### B1. M-5b — Supabase `auth.identities` 직접 INSERT 가능성 미검증
- **증거**: [11-MIGRATE.md M-5b](../11-MIGRATE.md) — "service_role 로 직접 insert".
- **위험**: Supabase `auth.identities` 는 **GoTrue 가 관리하는 system table**. service_role 키도 INSERT 가능 여부 불명. 대안: `auth.admin.createUser({...identities})` 또는 `auth.admin.linkIdentity()` 사용. 직접 INSERT 가 거부되면 Wave 1 전체가 막힘.
- **요구**: M-5b 에 "Supabase docs 확인 + 빈 프로젝트에서 1건 sample INSERT 시도 → 동작 여부 입증" 사전 작업 추가. 실패 시 `auth.admin.linkIdentity()` 경로 전환.

### B2. M-5d — Supabase managed env 에서 `DISABLE TRIGGER ALL` 권한 미검증
- **증거**: M-5d — "`ALTER TABLE auth.users DISABLE TRIGGER ALL` (service_role 권한 가능)" 단정.
- **위험**: Supabase managed 환경에서 `auth.users` 의 owner 는 `supabase_auth_admin` 또는 `postgres`. service_role 은 일반적으로 trigger 제어 권한 없음. 실 시도 시 `permission denied` 또는 `must be owner of table users`.
- **요구**: 두 옵션 명시:
  - (a) Supabase support 에 trigger temporarily disable 요청 (시간 소요)
  - (b) **본 트리거 무시하고 profiles INSERT 에 `ON CONFLICT (user_id) DO UPDATE` 만 사용** — 우회 가능
  - 권장: (b). M-5d 본문 수정.

### B3. M-2 — "142명" 하드코딩
- **증거**: M-2 — "출력 검증: 누락 사용자 142명 = 모든 사유 합계".
- **위험**: 142 는 Plan F 의 실패 통계 (사용자 사전 생성에서 63/202 만 매핑). v2 의 실 누락은 다를 수 있음 (가입 추가, 삭제 신청 등 시간 흐름 반영). 하드코딩된 142 가 의도하지 않은 통과 위장.
- **요구**: "Django 활성 사용자 수 = Supabase 매핑 수 + skip 사유별 합계" 로 동적 검증 변경.

### B4. C-14b ↔ C-21 시간선 모순
- **증거**: 
  - [11-CUTOVER C-14b](../11-CUTOVER.md) — "VPS Django Hard Block 503 유지 **48h**".
  - C-21 — "**VPS Django 컨테이너 중지**" — 위치는 §3.5 "폐기 (T+7d ~ T+30d)" 인데 명시적 시점 없음. T+48h 이후라고 가정하면 OK 지만, "DNS 캐시 잔존 사용자" 보호 만료가 48h vs VPS shutdown 1주 = 48h~7d 사이 공백 처리 안 됨.
- **위험**: 48h 이후 VPS 가 어떻게 동작하는지 (계속 503? shutdown? 권한 일부 복구?) 미명세. 만약 그 사이 DNS 캐시 더 지속되는 ISP 가 있으면 사용자 영향 큼.
- **요구**: C-14b 와 C-21 사이에 "T+48h ~ T+7d: VPS 는 503 응답 유지 + DB shutdown 미실행. 7일 stable 후 컨테이너 중지" 명시 단계 추가.

---

## MAJOR (Wave 진행 중 fix)

### M1. M-3 — 중복 이메일 정책 결정 미적용
- **증거**: M-3 — "자동 병합 or 명시적 알림" — 옵션 나열만, 결정 없음.
- **요구**: 사용자 결정 또는 default — "자동 병합 (이메일 unique 가정)" 적용 명시.

### M2. C-9c — 모바일 hotfix timeline 미고려
- **증거**: C-9c — "없으면 hotfix 배포 후 컷오버 가능".
- **위험**: 앱스토어 (iOS) 리뷰 24~72h, Play Store 24~48h. "컷오버 가능" 시점이 사용자가 인지하는 timeline 보다 훨씬 길어질 수 있음.
- **요구**: C-9c 에 "hotfix 필요 시 컷오버 일정 +7d (앱스토어 리뷰)" 명시 + 사용자 사전 알림 의무.

### M3. F-17 ↔ M-5c 의존성
- **증거**: M-5c — "Supabase Pro tier 필요할 수 있음 — F-? 작업에서 사전 확인" (F-? 가 F-17 임 명시 누락).
- **위험**: F-17 (tier 사전 확인) 이 Wave 0 (FOUND) 에 있고, M-5c (password_verification_hook) 가 Wave 1 (MIGRATE) 에 있음. F-17 결과에 따라 M-5c 의 path (a 또는 b) 가 정해지는데, Wave 의존성 명시 없음.
- **요구**: M-5c 본문에 "F-17 통과 후만 시작" + 만약 free tier 결정 시 M-5c (b) 강제 reset 로 회귀 명시.

### M4. A-2/A-3 — Apple Sign In credential 누락
- **증거**: [11-AUTH A-3](../11-AUTH.md) — "Apple Sign In Provider 등록 (Service ID + Private Key)".
- **위험**: Apple Sign In 은 (1) Service ID (2) Team ID (3) Key ID (4) Private Key (.p8) 4개 모두 필요. Team ID/Key ID 누락 시 OAuth flow 실패.
- **요구**: A-3 의 credential 항목 4개 모두 명시.

### M5. catalog ↔ GitHub 187 1:1 검증 없음
- **증거**: Gate G 후 jq aggregation 으로 187 카운트 확인은 했으나, **catalog.json 의 각 issue title 이 GitHub issue 와 1:1 매핑** 되는지 비교 없음. 중복 생성 또는 누락 가능성.
- **요구**: scripts/migrate-v2/ 에 `verify-issues.sh` 추가 — catalog 의 title 목록 vs `gh issue list` title 목록 set diff.

---

## MINOR (선택 — Backlog 가능)

| # | 항목 | 위치 |
|---|---|---|
| Mn1 | C-12 Cloudflare/Vercel 단일 provider 의존성 (둘 다 다운 시 fallback 없음) | 11-CUTOVER §3.2 |
| Mn2 | F-15/16 초기 `supabase db diff` 큰 출력 처리 가이드 | 11-FOUND |
| Mn3 | Wave 1 (MIGRATE 단독) timebox 없음 — 무한정 가능 | 10-plan-overview §3 |
| Mn4 | 'PRE-7 무제한' 의 staling 위험 (production drift) | 10-plan-overview PRE-7 |
| Mn5 | GitHub issue 간 의존성 native 표기 없음 (linked issues / blocked-by) | 40-github-mapping |
| Mn6 | M-9 round-trip 20명 vs Critical 3 = 0% 는 sample 이 아닌 **count exhaustive match** 명시 필요 | 11-MIGRATE M-6 vs M-9 |
| Mn7 | Wave 2 11-PWA 의 FCM SDK init 시점 명확화 (SDK init OK / token register 지연만) | 11-PWA §3 vs §4 |
| Mn8 | M-5b 의 auth.identities UUID primary key 생성 정책 (Supabase 자동 vs Django ref 보존) | 11-MIGRATE M-5b |
| Mn9 | C-7 점검 공지 시점/길이 미정 | 11-CUTOVER §3.2 |

---

## 적용 권고

**즉시 적용 (BLOCKING 4건)**:
- B1: M-5b 에 sample INSERT 사전 검증 작업 추가
- B2: M-5d 의 trigger DISABLE 을 ON CONFLICT 방식으로 우회
- B3: M-2 의 142 하드코딩 → 동적 계산
- B4: C-14b ↔ C-21 시간선 명시화 (T+48h ~ T+7d 구간)

**선택 적용 (MAJOR 5건)**:
- M1~M5 — 사용자 결정 시점에 따라

**MINOR 9건**: backlog 처리.

---

## 외부 재검증 권장
본 self-critique 가 외부 Momus + Oracle 의 다른 시각을 100% 대체하지 않음. credits 충전 후 외부 R-final 1회 추가 권장.

<!-- self-critique-date: 2026-05-28 -->
<!-- claude-opus-4-7 adversarial review of own plan -->
<!-- external-rerun-blocked: opencode workspace credits + antigravity 3 accounts 401 -->
