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
| C-7 | 점검 공지 게시 — 사용자 알림 (메일 또는 SNS) | 공지 url + 게시 스크린샷 |
| C-8 | `MAINTENANCE_MODE=true` 활성화 (Vercel env, Nuxt 측 동일) | curl `/` → `/maintenance` 302 |
| C-9 | Django/Nuxt 측 maintenance 페이지로 전환 | curl 응답 확인 |
| **C-9b** | **Hard Block 503 모드** (Oracle Critical #2 — silent data loss 방지) — Nginx/Django 측에서 모든 `/api/*` 요청에 `HTTP 503 Service Unavailable` + JSON body `{"error":"app_updated","message":"앱이 업데이트되었습니다. 앱을 완전히 종료 후 다시 실행해주세요"}` 응답. 클라이언트 측 (Nuxt) 도 maintenance 안내 + force reload 버튼. MySQL `INSERT/UPDATE/DELETE` 권한 REVOKE 도 병행 (이중 안전) | curl → 503 + 안내 JSON. 모바일 앱 시뮬: 토큰 가진 요청도 503. silent fail 0 |
| C-10 | 라이브 데이터 최종 추출 (MySQL dump) | snapshot 파일 |
| C-11 | 마이그레이션 풀 실행 (real, dry-run 아님) | validation_report.json overall=pass + Critical 3 테이블 0% 손실 검증 |
| C-12 | Cloudflare DNS 전환 — A→CNAME (Vercel) | `dig maeil1dok.app` → Vercel IP |
| C-13 | `MAINTENANCE_MODE=false` 비활성화 | curl `/` → 200 |
| C-14 | 즉시 스모크 테스트 — OAuth 1건 + 본문 1건 + 진도 조회 1건 | Playwright session 3건 모두 통과 |
| **C-14b** | **VPS Django 측 Hard Block 503 유지 48h** (Oracle Critical #2 수정) — DNS 캐시 잔존 사용자에게 silent fail 대신 명시적 안내 + force reload. INSERT/UPDATE 권한 미복구 (이중 안전) | DNS 전파 모니터링 + 503 응답 검증 + 사용자 문의 채널 모니터 |

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

### 3.5 폐기 (T+7d ~ T+30d)

| # | 작업 | DoD |
|---|---|---|
| C-21 | VPS Django 컨테이너 중지 | `docker compose down` 출력 |
| C-22 | VPS 서버 자체 폐기 결정 (1주 stable 후) | 사용자 결정 + 인보이스 정리 |
| C-23 | 1개월 후: `migration_user_mapping` 테이블 드랍 | SQL 실행 로그 |
| C-24 | 1개월 후: `scripts/migrate/data/` 디렉토리 삭제 (민감 데이터) | rm + 검증 |

---

## 4. 롤백 정책 — Fix-Forward Only (Momus R1 BLOCKING #3 반영)

**원칙 변경**: 직전 안 (DNS 롤백 → Django 복귀) 은 **Supabase 측 신규 데이터의 역방향 마이그레이션 부재**로 split-brain 위험. 이를 차단하기 위해 **Fix-Forward Only** 로 확정.

| 트리거 | 행동 |
|---|---|
| 컷오버 후 1시간 내 핵심 라우트 5xx > 5% | **DNS 롤백 금지**. `MAINTENANCE_MODE=true` 즉시 ON → Vercel 측 hotfix 배포 → MAINTENANCE OFF |
| 인증 실패 비율 > 30% | 동일. Supabase 측에서 fix |
| Supabase 데이터 정합성 에러 발견 | MAINTENANCE ON → 마이그레이션 보정 스크립트 → MAINTENANCE OFF |
| **치명적 미해결 버그** (예: 본문 안 나옴 등 사용자 진입 자체 불가) | MAINTENANCE 장기간 + 사용자 안내 + Vercel hotfix. **DNS 역행은 영구 금지** |

**근거**:
- Big Bang + Forward only = Supabase 가 SoT. Django/Vercel 의 데이터 충돌 가능성 0.
- 롤백 옵션을 닫는 대가로 사전 검증 (Wave 1~5 + 컷오버 직전 dry-run N회) 을 통과해야만 컷오버 가능.
- Wave 6 진입 조건에 "11-MIGRATE 의 검증이 전부 PASS + 핵심 3 테이블 0% 손실 입증" 명시.

**DNS 전파 지연 대응** (Momus R1 Hidden #3):
- ISP DNS 캐시 최대 48h. **컷오버 후 48시간 동안 VPS Django 를 read-only 모드 (DB user REVOKE INSERT/UPDATE/DELETE)** 로 유지. 캐시 안 풀린 사용자는 Django 응답을 받되 데이터 변경 불가, OAuth 시도 시 maintenance 안내.

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
