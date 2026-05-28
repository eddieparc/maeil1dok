# 11-CUTOVER · 실 컷오버

> **슬라이스 ID**: 11-CUTOVER  
> **Wave**: 6 (마지막, 직렬)  
> **의존**: 11-FOUND, 11-AUTH, 11-MIGRATE, 11-READER, 11-PROGRESS 모두 통과  
> **추정 크기**: M  
> **상태**: 스켈레톤 — Plan F 의 Task 9~13 + 회수해야 할 부분

---

## 1. 목표

운영 도메인 `maeil1dok.app` 을 Nuxt+Django(VPS) → Next+Supabase(Vercel) 로 전환한다.
**점진적 베타 vs Big Bang 은 PRE-1 결정에 따른다.**

---

## 2. 재활용 가능한 직전 산출물

Plan F 에서 만들어졌고 v2 에서도 유효한 것:

| 파일 | 상태 | 재활용 |
|---|---|---|
| [scripts/migrate/RUNBOOK.md](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/scripts/migrate/RUNBOOK.md) | 완성 | 그대로 활용 가능, 일부 갱신 |
| [scripts/migrate/04-validate.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/scripts/migrate/04-validate.ts) | 완성 | 5% 임계 → hard fail 로 강화 후 활용 |
| [middleware.ts](file:///Users/jgp/GitHub/maeil1dok/maeil1dok-next/src/middleware.ts) MAINTENANCE_MODE | 완성 | `/maintenance` 페이지 실 구현 필요 (11-FOUND 으로 이전) |

11-MIGRATE 슬라이스에서 02·03·04 스크립트는 v2 기준으로 재작성 (5% hard fail 적용).

---

## 3. 작업 항목

### 3.1 사전 검증 (T-7d ~ T-1d)

| # | 작업 | DoD |
|---|---|---|
| C-1 | 모든 11-* 슬라이스 통과 확인 (GitHub Milestone 모두 closed) | Milestone state 검증 |
| C-2 | 라이브 사이트의 (Nuxt) 최종 백업 — DB dump + 정적 자산 | `final_backup_YYYYMMDD.sql` + S3 / 외부 보관 |
| C-3 | Supabase 프로젝트 클린 상태 검증 — 이전 부분 마이그레이션 데이터 제거됨 | row count 0 (모든 user-data 테이블) |
| C-4 | OAuth 리디렉트 URI 업데이트 (Kakao/Google/Apple Developer Console) | playwright로 각 OAuth 진입 → Supabase 콜백 URL 확인 |
| C-5 | Vercel 커스텀 도메인 추가 + SSL 발급 확인 | `https://maeil1dok.app` curl HEAD → x-vercel-id 헤더 |
| C-6 | 11-MIGRATE 의 풀 dry-run 다시 실행 — 100% 매핑 검증 | validation_report.json overall=pass + 5% 임계 0건 위반 |

### 3.2 컷오버 당일 (T-0) — Hard DB Lock 추가 (Momus R1 Major #3)

| # | 작업 | DoD |
|---|---|---|
| C-7 | 점검 공지 게시 — 사용자 알림 (메일 또는 SNS). **Mn9: 컷오버 시점 T-7d 사전 공지 + T-1d 재공지 + T-0 점검 시작 공지. 점검 길이 default 4시간 (장인정신이라도 사용자 영향 최소화). 실 시간 초과 시 +1h 단위 추가 공지** | 3회 공지 URL + 게시 스크린샷 |
| C-8 | `MAINTENANCE_MODE=true` 활성화 (Vercel env, Nuxt 측 동일) | curl `/` → `/maintenance` 302 |
| C-9 | Django/Nuxt 측 maintenance 페이지로 전환 | curl 응답 확인 |
| **C-9b** | **Hard Block 503 모드** (Oracle Critical #2) — Nginx/Django 측에서 모든 `/api/*` 요청에 `HTTP 503 Service Unavailable` + JSON body `{"error":"app_updated","message":"앱이 업데이트되었습니다. 앱을 완전히 종료 후 다시 실행해주세요"}`. MySQL `INSERT/UPDATE/DELETE` 권한 REVOKE 도 병행. | curl → 503 + 안내 JSON |
| **C-9c** | **구 클라이언트 503 처리 역검증 + hotfix timeline** (Oracle R2 Major #4, Self-critique MAJOR M2) — 컷오버 전 사전 작업: 현재 배포된 Nuxt + 모바일 앱이 503 `app_updated` 응답을 받았을 때 (1) 사용자에게 안내 UI 표시 + (2) 앱스토어/Play 스토어로 유도하는 로직 **실제 존재 검증**. **없으면 hotfix 배포 필요 = 컷오버 +7d (iOS 리뷰 24~72h + Play Store 24~48h + 사용자 업데이트 propagation 며칠).** 사용자 사전 알림 의무. | grep 코드 + 모바일 실 디바이스 503 시나리오 테스트 + hotfix 시 컷오버 일정 조정 발표 |
| C-10 | 라이브 데이터 최종 추출 (MySQL dump) | snapshot 파일 |
| C-11 | 마이그레이션 풀 실행 (real, dry-run 아님) | validation_report.json overall=pass + Critical 3 테이블 0% 손실 검증 |
| C-12 | Cloudflare DNS 전환 — A→CNAME (Vercel). **Cloudflare proxy off (grey cloud) — WAF/DDoS 보호 사라짐, Vercel 자체 인프라가 흡수** (자가 R3 Self-6). Vercel Edge Network + Firewall Rules 설정 사전 검토. **Mn1: Cloudflare DNS authoritative + Vercel CDN 단일 의존 — 둘 다 다운 시 fallback 없음을 사용자 인지하고 운영.** | `dig maeil1dok.app` → Vercel IP + Vercel Firewall 활성 확인 |
| C-13 | `MAINTENANCE_MODE=false` 비활성화 | curl `/` → 200 |
| C-14 | 즉시 스모크 테스트 — OAuth 1건 + 본문 1건 + 진도 조회 1건 | Playwright session 3건 모두 통과 |
| **C-14b** | **VPS Django 측 Hard Block 503 유지 48h** (Oracle Critical #2 수정) — DNS 캐시 잔존 사용자에게 silent fail 대신 명시적 안내 + force reload. INSERT/UPDATE 권한 미복구 (이중 안전) | DNS 전파 모니터링 + 503 응답 검증 + 사용자 문의 채널 모니터 |
| **C-9d** | **Cache invalidation 5중 차단** (Oracle R-final Major #5) — Hard Block 503 이 cache/SW 경로로 우회될 수 있어 다음 모두 적용: (1) **Cloudflare full purge** — `cf-cli purge --zone maeil1dok.app --everything` (DNS 전환 직전 + 직후 2회). (2) **Service Worker version bump + auto-update** — Wave 6 진입 시 Nuxt SW 의 `cacheName` 버전 강제 갱신 + `skipWaiting()` + `clients.claim()` 적용한 hotfix 배포 (컷오버 -3d). 사용자 다음 접속 시 자동 SW 교체. (3) **`Cache-Control: no-store` on 503** — Nginx 측 503 응답 헤더에 `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` 강제. CDN / 브라우저 / SW 모두 캐싱 차단. (4) **HTML shell `<meta http-equiv="refresh" content="0; url=/maintenance">`** — 캐시된 구 Nuxt shell 이 떠도 즉시 maintenance 페이지로 리다이렉트 (사용자 무한 로딩 차단). (5) **컷오버 -2d 사전 검증 (재현 테스트)** — 다음 시나리오 staging 에서 실 검증: 모바일 Safari/Chrome 에서 구 SW 캐싱된 shell 진입 → 503 응답 → 사용자가 보는 화면이 maintenance + 새 SW 자동 인스톨. | (1) Cloudflare purge log + cache-status MISS 검증. (2) SW 버전 갱신 commit + Wave 6 -3d 배포 evidence. (3) `curl -I` 응답에 no-store 검증. (4) `<meta refresh>` HTML grep. (5) staging 재현 테스트 결과 (`.sisyphus/evidence/C-9d-cache-replay-{safari,chrome,sw}.txt`) |

### 3.3 컷오버 직후 (T+0 ~ T+24h)

| # | 작업 | DoD |
|---|---|---|
| C-15 | Vercel 로그 모니터링 — 5xx, 4xx, 인증 실패 비율 추적 | 24h 로그 리포트 |
| C-16 | Supabase 사용량/에러 모니터링 | dashboard 스크린샷 |
| C-17 | 사용자 문의 채널 모니터링 | issue tracker |
| C-18 | OAuth 재로그인 안내 푸시 (FCM 또는 메일) — 비밀번호 재설정 필요한 사용자 | 안내 발송 로그 |

### 3.4 안정화 (T+1d ~ T+7d)

| # | 작업 | DoD |
|---|---|---|
| C-19 | 데이터 정합성 재검증 — 7일 후 1회 더 | validate.ts 재실행 + 신규 사용자 통계 |
| C-20 | 직전 7일 동안의 사용자 활동량 비교 (Nuxt 마지막 7일 vs Next 첫 7일) | 추세 그래프 |

### 3.4-bis 시간선 명시 (T+48h ~ T+7d) — Self-critique B4

C-14b 의 "VPS Hard Block 48h" 이후 ~ C-21 의 "VPS 중지" (T+7d 가정) 사이 공백 처리:

| # | 작업 | DoD |
|---|---|---|
| **C-19b** | T+48h ~ T+7d 동안 VPS 503 응답 유지 + DB shutdown 미실행. DNS 캐시 더 지속되는 ISP 보호 연장 | 매일 1회 curl `/api/health` → 503 응답 확인 + 사용자 문의 모니터링 0 |

### 3.5 폐기 (T+7d ~ T+30d)

| # | 작업 | DoD |
|---|---|---|
| C-21 | VPS Django 컨테이너 중지 (**C-19b 통과 + 1주 stable 확인 후만**) | `docker compose down` 출력 |
| C-22 | VPS 서버 자체 폐기 결정 (1주 stable 후) | 사용자 결정 + 인보이스 정리 |
| C-23 | 1개월 후: `migration_user_mapping` 테이블 드랍 | SQL 실행 로그 |
| C-24 | 1개월 후: `scripts/migrate/data/` 디렉토리 삭제 (민감 데이터) | rm + 검증 |

---

## 4. 롤백 정책 — Fix-Forward Only + Incident Ladder (Momus R1 BLOCKING #3 + Oracle R-final Major #7 + Minor #2 반영)

**원칙 변경**: 직전 안 (DNS 롤백 → Django 복귀) 은 **Supabase 측 신규 데이터의 역방향 마이그레이션 부재**로 split-brain 위험. 이를 차단하기 위해 **Fix-Forward Only** 로 확정.

| 트리거 | 행동 |
|---|---|
| 컷오버 후 1시간 내 핵심 라우트 5xx > 5% | **DNS 롤백 금지**. `MAINTENANCE_MODE=true` 즉시 ON → Vercel 측 hotfix 배포 → MAINTENANCE OFF |
| 인증 실패 비율 > 30% | 동일. Supabase 측에서 fix |
| Supabase 데이터 정합성 에러 발견 | MAINTENANCE ON → 마이그레이션 보정 스크립트 → MAINTENANCE OFF |
| **치명적 미해결 버그** (예: 본문 안 나옴 등 사용자 진입 자체 불가) | MAINTENANCE 장기간 + 사용자 안내 + Vercel hotfix. **DNS 역행은 영구 금지** |

### 4.1 Incident Ladder (Oracle R-final Major #7 — "장기간 maintenance + hotfix" 가 Plan G 크기로 확장되지 않도록 의사결정 경계 명시)

| 경과 시간 | 단계 | 행동 | 사용자 커뮤니케이션 |
|---|---|---|---|
| 0 ~ 4h | **L1 — Hotfix Window** | MAINTENANCE ON 유지하며 Vercel hotfix 배포 시도. 4h 안에 해결 시 정상 컷오버 인정 | T+0 점검 시작 공지 + T+4h 단위 진행상황 공지 |
| 4 ~ 24h | **L2 — Mitigation Window** | hotfix 실패. AI 자율 fix 권한 종료 — **사용자 alert**. 우회/완화책 모색 (예: 기능 일부 disable, RLS 임시 완화, 핵심 라우트만 서비스). 사용자에게 timeline 재공지 | T+4h "기술적 문제로 점검 연장. 예상 +Xh" + T+12h 추가 공지 |
| 24 ~ 72h | **L3 — Emergency Scope (사용자 승인 필요)** | mitigation 도 실패. **사용자 명시 승인 없이 신규 코드 작성 금지**. 다음 선택지를 사용자에게 제출: (a) 추가 24~48h mitigation 시도 (b) Wave 6 일부 기능 deferred-cutover (예: ANNOTATE/SOCIAL 만 보류) (c) Plan G 선언 (마이그레이션 별도 재계획) | T+24h "장기 점검 결정 필요. 24h 내 재공지" + 다음 단계 결정 후 즉시 공지 |
| 72h+ | **L4 — Plan G Declaration** | 사용자 결정에 따라 마이그레이션 자체를 일시 중단. Supabase write freeze + 영구 read-only 503 + 신규 가입 hard block. DNS 롤백 여전히 금지 (split-brain 차단). Plan G 별도 디렉토리 작성 후만 재개 | T+72h "장기 중단 공지 + 복구 일정 별도 안내" + 일간 진행 공지 |
| **T+96h** | **L4-Gate — Mandatory Decision** (Oracle R-rerun-final Major #1 — L4 escape hatch 차단) | T+96h 시점 (L4 진입 24h 후) **반드시** 다음 3 옵션 중 1개 사용자 명시 승인 + 문서 commit: **(a) Plan G 승인 — `docs/migration-v2/60-plan-g/` 디렉토리 작성 (owner / timeline / max outage / acceptance criteria 명시) + 사용자 서명**, **(b) Emergency Degraded Service — 사용자 승인 하 기능 일부 영구 비활성 + 잔여 기능만 운영 + DoD 재정의**, **(c) Migration Pause — Supabase 측 데이터 보존 + VPS 일정 부분 read-only 복원 (Hard Block 503 해제하되 OAuth/write 차단; split-brain 방지 위해 신규 데이터 0 보장) + recovery path 사용자 합의**. 어느 옵션도 T+96h 까지 미선택 시 자동 (c) Migration Pause 진입 + 사용자 24h 내 결정 요구. **무기한 503/write-freeze 금지 — L4 는 96h 안에 다음 단계로 이행해야 한다** | T+96h decision document commit (`docs/migration-v2/60-incident-{ts}/decision.md`) + 사용자 명시 서명 evidence + (자동 (c) 발동 시) recovery path 합의 evidence |

**Write Freeze 조건** (모든 L 단계에서 적용 가능): Supabase 데이터 정합성 위험 발견 시 즉시 발동. 모든 사용자 write 차단 (RLS deny all on user-data tables) + read-only 유지 + L 단계와 무관하게 사용자 즉시 공지. write freeze 해제는 사용자 명시 승인 후만.

**Comms Cadence**: L1=4h 단위, L2=4~6h 단위, L3=24h 단위 + 결정 직후, L4=일간 + 결정 직후.

**근거**:
- Big Bang + Forward only = Supabase 가 SoT. Django/Vercel 의 데이터 충돌 가능성 0.
- 롤백 옵션을 닫는 대가로 사전 검증 (Wave 1~5 + 컷오버 직전 dry-run N회) 을 통과해야만 컷오버 가능.
- Wave 6 진입 조건에 "11-MIGRATE 의 검증이 전부 PASS + 핵심 3 테이블 0% 손실 입증" 명시.

**DNS 전파 지연 대응** (Momus R1 Hidden #3 + Oracle R-final Minor #2 — read-only 표현 제거):
- ISP DNS 캐시 최대 48h. **컷오버 후 48시간 동안 VPS Django 를 Hard Block 503 모드 (C-9b 와 동일)** 로 유지 (DB user REVOKE INSERT/UPDATE/DELETE 도 병행 — 이중 안전, 단 "read-only 모드" 라는 표현은 사용하지 않음. 사용자가 read 라도 가능하다고 오해하지 않도록 503 단일 표현 사용). 캐시 안 풀린 사용자는 Django 응답 대신 503 + `{"error":"app_updated"}` JSON 만 받음, OAuth 시도 시도 동일.

---

## 5. DoD 통합

- **CHANGE**: DNS 레코드 변경 로그 + Vercel 도메인 설정 스크린샷 + maintenance 토글 commits
- **EVIDENCE**: `.sisyphus/evidence/11-CUTOVER-*` — dig/curl/playwright 결과 + 24h 모니터링 리포트
- **REPRODUCE**: 본 슬라이스는 1회성. 재현 명령은 dry-run 모드 (`scripts/migrate/run-migration.ts --dry-run`)
- **ASSERTION**:
  - DNS: Vercel resolve
  - HTTPS: x-vercel-id present
  - Data integrity: validate.ts pass (5% hard fail 통과)
  - OAuth: 3 providers Kakao/Google/Apple smoke 통과
  - User progress visible after re-login: 사용자 5명 round-trip 검증

<!-- plan-checksum: PENDING -->
