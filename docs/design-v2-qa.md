# LAB-127 design v2 verification ledger

Status: IN PROGRESS. No row below is accepted without captured evidence. Source: `design_handoff_maeil1dok_v2/08_QA_CHECKLIST.md`. Existing test or worker success alone does not establish browser acceptance.

## Acceptance recording

Each viewport/theme cell must link screenshots and an action record before changing to PASS. The action record names the exact URL and fixture identity, state, selector pinned before the action, trigger, awaited event, observed result, console errors, overflow measurement, and evidence path. Route patterns below are inventory, not executed URLs. Record concrete IDs and query values before use.

Use the existing Aside account session only. Do not restart the user browser or create a temporary browser profile. Local and beta evidence are distinct; final acceptance requires beta.

Aside capture calibration found intact 2x raster viewports inside tiled PNGs: 390x844 CSS pixels occupy `(0,0,780,1688)` and 1280x900 occupy `(0,0,2560,1800)`, with right/bottom exclusive. The lead inspected both original diagnostic images; corner borders, marker sizes, complete text and bottom anchors agree with the 2x mapping. Preserve each raw image and a separately labeled exact-pixel extraction, without resampling or stitching. Record CSS viewport, actual raster scale and crop bounds. Validate anchors and complete content for every real capture; a blank, partial or inconsistent image still fails. This calibration alone accepts no product UI.

## Route and state matrix

| Route | Required states/actions | 390x844 light | 390x844 dark | 1280x900 light | 1280x900 dark |
|---|---|---|---|---|---|
| `/` | guest, authenticated, loading, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/hasena` | guest, authenticated, loading, empty, error, settings | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/profile/[id]` | self, other, loading, empty, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/login` | guest, validation, submitting, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/register` | guest, validation, submitting, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/groups` | loading, empty, populated, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/groups/[id]` | member, nonmember, loading, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/scoreboard` | guest, authenticated, loading, empty, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/friends` | guest, authenticated, loading, empty, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/notifications` | loading, empty, populated, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/account/settings` | authenticated, settings, confirmation, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible` | hub, first visit, no plan, loading, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible?book=&chapter=` | guest, authenticated, tongdok, audio, selection, overlays | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/search` | q=빛, empty query, no results, version change, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/history` | calendar four states, month change, book filter | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/notes` | loading, empty, populated, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/notes/[id]` | read, edit, private, unsaved exit, delete confirmation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/highlights` | loading, empty, populated, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/bookmarks` | loading, empty, populated, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/bible/settings` | sheet, font, size, line height, emphasis, persistence | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/intro` | loading, empty, populated, checked, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/intro/[id]` | loading, populated, completion, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/plan` | guest, four reading states, month jump, bulk edit | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/plans` | subscribed, available, hidden, subscribe, delete confirmation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/register-email` | validation, submitting, success, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/kakao/setup` | validation, submitting, success, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/google/setup` | validation, submitting, success, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/apple/setup` | validation, submitting, success, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/forgot-password` | validation, submitting, success, error | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/reset-password` | checking, invalid or expired, form, complete | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/verify-email` | checking, failed or expired, complete | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/[provider]/callback` | checking, success, failure | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/auth/error` | provider error, recovery | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/notice` | first expanded, collapse, expand | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/notice/plan-update` | detail, navigation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/install` | iOS, Android, install prompt eligibility | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/company` | information tab navigation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/terms` | information tab navigation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/privacy` | information tab navigation | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/support` | FAQ, contact validation, sending, success, failure | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/admin/members` | guest denied, nonstaff denied, staff, search/filter/sort, bulk, drawer, eight actions, audit, last-method rejection, masked CSV | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/admin/plans` | guard, CRUD, default, active, schedule CRUD/search/month/empty | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/admin/hasena` | guard, filter, edit, review, regenerate progress | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| `/admin/video/intro` | guard, three columns, delete confirmation, upload | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |

## Command and delivery receipts

| Gate | Evidence | Status |
|---|---|---|
| Faithful behavior RED, GREEN, matching browser action | Pending per changed seam | UNVERIFIED |
| Frontend npm test | Phase A: 346 passed; `/tmp/lab127-a-final-tests.log` and independent verifier log | Phase A PASS; final release rerun required |
| Frontend npm run build | Phase A: exit 0; `/tmp/lab127-a-verify-final-build.log`; new ToastHost optimizer warning fixed | Phase A PASS; final release rerun required |
| Frontend npm run typecheck:ratchet | Phase A: 148 existing errors, 84 signatures, new 0; baseline reduced from 154 after clean caches | Phase A PASS; final release rerun required |
| Backend complete SQLite tests | Pending exact environment, counts, exit code | UNVERIFIED |
| Backend complete MySQL tests for model changes | Pending isolated DB receipt, counts, exit code | UNVERIFIED |
| OpenAPI validation and generated frontend types | Pending schema/type equality evidence | UNVERIFIED |
| Admin HTTP personas and actions | Pending status, headers, redacted body, audit proof | UNVERIFIED |
| Atomic phase commits with Linear identifier | Record each verified phase hash | UNVERIFIED |
| Earlier LAB-126 auth-readiness integration | Lead independent run `bash_22`: seven focused files, 35 passed, exit 0; `/tmp/lab127-readiness-integration.md` records RED and coverage limits | Runtime PASS; browser pending |
| LAB-125 plain-chapter audio preservation | Commit `9122544b` records original RED 4 and GREEN 18; current independent `bash_23` ran `todos.test_chapter_audio_fallback`: 13 passed, exit 0, SQLite test DB destroyed | API PASS; final browser matrix pending |
| LAB-126 final followup integrated | Source sentinel read; parent `bash_24` four-target run: 30 passed, exit 0 after faithful auth fixture repair | Runtime PASS; browser pending |
| LAB-126 rollout coordination | Explicit user release received; source beta-deployment.md and final-verification.md inspected; image `sha256:72ba1ba174dbca4e6c21a2694a5d4840ff4e5fff0832cf3122c88944dfe8b78a` | Released; LAB-127 release gates remain |
| Beta deployment | Verified commit marker, curl -i, final route/state matrix | UNVERIFIED |
| Primary production unaffected | Before/after production receipt | UNVERIFIED |
| QA resource cleanup | Servers, temporary DBs, containers, owned tabs, receipts | UNVERIFIED |

## Deviations and limitations

- The original native component QA found paint/pointer stacking, a 40px notification target and a dark sheet-header seam. Those defects, remaining reduced-motion transitions and dark logo visibility were corrected. Targeted native retest passed all 78 checks with 18 inspected captures; the lead opened all 18 images and independently matched all 17 source hashes. Reports: `/tmp/lab127-a-browser-qa.md`, `/tmp/lab127-a-browser-retest.md`.
- Shared-component harness acceptance is not full Nuxt-route or beta acceptance. The route/state matrix above remains open for the final application. The harness uses real Vue components/services/router but controlled auth/Nuxt state, OS font fallback and no full Tailwind assembly.
- Existing duplicate UiSkeleton naming, BibleViewerSkeleton withDefaults warning and older template-only test-fixture warnings remain. New fixture input omissions and the ToastHost CSS optimizer warning exposed during integration were repaired without weakening assertions.
- LSP daemon is currently unreachable; command-based type/build checks are still mandatory.
- The focused audio API run reported the existing missing `backend/staticfiles/` directory warning. It did not fail the 13 tests; no static asset generation was performed for this API-only run.
- Further data-contract deviations must cite the handoff section, actual API contract, and implemented behavior. Missing historical values must not be fabricated.

## PR description evidence

For each phase, record changed files, verified commit, runtime RED/GREEN receipts, four viewport/theme screenshot links, deviations, and the checklist items accepted below. Final descriptions must not treat this unfinished ledger as completed QA.

Phase A description: `.omo/qa/lab127-phase-a-pr-description.md`. Four-set image manifest: `/tmp/lab127-a-browser-retest-image-manifest.json`; exact native measurements: `/tmp/lab127-a-browser-retest-results.json`. The lead confirmed no listener on owned QA port 4179 and no remaining owned PIDs 10925/10926/10927; the browser receipt preserves all 28 preexisting tabs. These are phase-local cleanup receipts, not a final cleanup claim for B-F.

## Full original 08 checklist

# 08 · QA 체크리스트 (PR마다 스스로 검증)

## 공통
- [ ] 액센트 외 임의 hex 없음(허용 예외만). 이모지 없음. 아이콘 lucide만.
- [ ] 필 버튼 999px, 카드 20px(리스트 카드 16px), Pretendard −0.4px, 숫자 `tabular-nums`.
- [ ] 화면당 primary 1개. 파괴적 액션은 `#B3261E` + 확인 모달(danger).
- [ ] 하단 탭바 5개 · 활성 스타일 · safe-area · ≥1024 사이드바.
- [ ] 시트: 핸들·스크림 탭 닫기·드래그 다운 닫기·350ms. 모달: ESC/스크림 닫기.
- [ ] 토스트 1.8s 단일 인스턴스. 로딩 스켈레톤·빈 상태·오류 상태 모두 존재.
- [ ] 다크 모드 깨짐 없음(토큰만 사용했다면 자동). `prefers-reduced-motion` 시 모션 제거.
- [ ] 히트 영역 44px, 포커스 링, 스크린리더 라벨(아이콘 버튼 `aria-label`).
- [ ] `npm test`, `npm run build`, Playwright 기존 테스트 통과. `data-testid` 유지.

## 02 성경 리더
- [ ] 헤더 ‹ 책/장 › + 검색·오디오(조건)·가이드(통독)·⋯·통독(조건). 북마크 토글은 ⋯ 메뉴.
- [ ] 스크롤 다운 시 탭바 숨김, 업 시 표시. 시트 열림 중엔 유지.
- [ ] 오디오: 재생/일시정지·seek·속도 5단계·닫기·종료 시 통독 자동 완료.
- [ ] 통독 행: 세그먼트 색 3상태, 완료 버튼 상태 전환, 범위 밖 토스트, 전부 완료 → 모달.
- [ ] 성경 선택: 역본 칩 전환, 검색(약어/초성/접두) 결과·바로가기·Enter, 책/장 2열, 현재 위치 스크롤.
- [ ] 절 탭 → 컨트롤, 팔레트 4색 저장/삭제, 복사, 공유 → 시트.
- [ ] 공유 시트: 스토리/게시물 전환 시 슬라이드 재구성·인덱스 0, 스냅 스와이프, 도트 탭 이동, 밝게/어둡게(구절·오늘 완료만), 정방 구절 하단 “2026 성경통독”.
- [ ] 완료 모달: 하이라이트 구절 목록(오늘 범위만) → 해당 카드로 공유 시트, SNS 공유, 다음 일정.
- [ ] 읽기 설정 시트 변경이 본문에 즉시 반영, 저장 디바운스.

## 03 허브·검색
- [ ] 성경 홈 5섹션 + 첫 방문·플랜 없음·로딩 상태. 팁 닫기 영구.
- [ ] 검색: 한 글자 허용, 빈 값 안내, 역본 변경 재검색, 그룹 접기(첫 그룹 펼침), mark 강조, 빈 결과 + 전체 역본 제안.
- [ ] 읽기 기록: 캘린더 4상태·월 이동, 책별 필터·완독 체크.
- [ ] 노트: 변경 감지 → 저장 활성, 비공개 스위치, 삭제 confirm, 미저장 이탈 확인.
- [ ] 개론: 이번 주 배지, 체크 토글, 상세 완료 버튼 상태.

## 04 플랜
- [ ] 월 칩 점 3상태, 오늘/마지막 미완료 점프(월 전환 포함), 월 요약 바.
- [ ] 행 4상태 배지·체크 스타일, 같은 날 그룹.
- [ ] 일괄수정 3단계 메시지·범위 하이라이트·읽음/읽지 않음 적용·모드 종료.
- [ ] 비로그인 안내·로그인 모달, 행 탭 이동 확인 모달, 맨 위로 버튼.
- [ ] 플랜 관리: 링 pct, 숨김 카드 배지·opacity, 완전 삭제는 숨김 상태에서만, 구독 시 섹션 이동.

## 05 인증·정보
- [ ] 실시간 검증 메시지(오류/성공), primary opacity .45 비활성, 제출 중 라벨.
- [ ] 재설정 4상태·인증 3상태 라우팅, 강도 3칸 색.
- [ ] 공지 펼침/첫 항목 기본 펼침, 설치 OS 탭·프롬프트 조건, 정보 4탭 라우트 동기화, FAQ·문의 전송.

## 06 관리자
- [ ] staff 가드 3상태(비로그인/권한 없음/정상).
- [ ] 회원: 검색·필터·정렬 조합, 전체 선택·일괄 3작업, 드로어 4탭, 계정 작업 8종 상태 반영 + 감사 로그, 마지막 로그인 수단 해제 불가.
- [ ] 플랜: 생성/수정/기본 지정/활성 토글, 일정 CRUD·검색·월 필터·빈 결과.
- [ ] 하세나: 필터, 수정 저장 → 검수 완료, 재생성 진행 표시 → 검수 필요.
- [ ] 개론: 카드 3열, 삭제 confirm, 엑셀 업로드 모달.

