# Frontend -> Django API inventory

> 조사 기준: 2026-08-26 현재 작업 트리. Nuxt 실행 코드(`frontend/app`, `frontend/server`)의 HTTP 호출 표현식을 세고, Django resolver를 `config.test_settings`로 펼쳐 실제 URLPattern에 매칭했다. 테스트/주석/타입 문서의 경로 문자열은 호출로 세지 않았다. `mobile/`은 Django route의 별도 소비자 판별에만 사용했다.

## 1. 요약과 계수 기준

| 항목 | 실측 | 의미 |
|---|---:|---|
| 프론트 백엔드 호출 지점 | **180** | 소스의 실제 HTTP 호출 표현식. 조건식 URL도 호출 표현식 1건으로 센다. |
| 호출 지점이 있는 파일 | **49** | endpoint를 실제 실행하는 파일 기준 |
| 경로 대안 수 / 고유 경로 문자열 | 183 / **148** | 조건식 3곳은 한 호출 지점에 경로 2개. `${...}` 변수명과 query까지 보존한 값 |
| 매칭된 canonical Django template | **128 / 155** | `auth/accounts` 이중 mount와 DRF format suffix를 접어 센 논리 template |
| 프론트 -> 백엔드 경로 불일치 | **0 호출 / 0 경로** | HTTP method까지 검증했으며 method 불일치도 0 |
| 백엔드 -> 프론트 미사용 | **27 canonical template** | 이 중 mobile 전용 2, web/mobile 모두 미사용 25. 등록 pattern 그대로는 97개 미호출 |

HTTP method 분포: GET 80, POST 73, PATCH 11, PUT 5, DELETE 11.

### 제시된 출발점 재현과 차이

- `rg -o --no-filename '/api/v1/[a-z0-9_/-]+' frontend/app --glob '*.{vue,ts,tsx,js,jsx}' | sort -u | wc -l`은 **103**을 재현한다. 다만 이 식은 `${...}` 앞에서 템플릿을 잘라 서로 다른 호출을 합치고, `useApi.ts`의 allowlist/guard와 주석/타입 경로도 포함하며, `frontend/server`의 cron 호출은 제외한다. 따라서 103은 endpoint 종류나 호출 지점 수가 아니다 (`frontend/app/composables/useApi.ts:169-183,214-230`; `frontend/app/types/bible.ts:156-183`; `frontend/server/api/cron/hasena-summary.get.ts:66-73`).
- 실제 호출 표현식은 **180**, 호출에서 해석되는 고유 경로 문자열은 **148**, Django canonical route template은 **128**이다. 반복 호출과 동일 route의 query/변수명 차이가 있어 세 수가 다르다.
- 현재 wrapper 호출 파일 합집합은 **50개**다. `usePlanApi`/`useScheduleApi` 함수 선언 파일 2개를 빼고 소비자만 세면 **48개**다: `useApi()` 47파일, `usePlanApi()` 4파일(선언 포함), `useScheduleApi()` 4파일(선언 포함), `useApiCache()` 0파일. 제시된 52파일은 현재 트리에서는 재현되지 않는다. `useApiCache`는 HTTP를 직접 부르지 않고 전달받은 callback을 캐시할 뿐이다 (`frontend/app/composables/useApiCache.ts:89-146`).
- `fetch(`가 있는 파일은 현재 5개다. 공통 transport인 `useApi.ts`를 빼면 제시된 **원시 fetch 4파일**이 재현된다. 그중 `frontend/server/api/hasena/latest-video.get.ts:137,186`은 YouTube만 호출하므로 Django 표에서 제외했다. `useApi.ts:93,123`의 두 fetch는 최초/재시도 transport이며 endpoint 호출 지점으로 중복 계수하지 않았다.
- backend resolver는 API URLPattern **225개**, unique route name **154개**, canonical template **155개**를 재현했다. 근거 URLConf는 `backend/config/urls.py:21-28`, `backend/accounts/urls.py:7-97`, `backend/todos/urls.py:5-116`, `backend/bible_cache/urls.py:4-24`다.

## 2. 호출 지점 전수 표

분류: **리터럴**은 첫 인자가 문자열 리터럴, **템플릿 리터럴**은 첫 인자가 backtick template, **변수/조건식**은 URL identifier를 따라가 initializer/분기를 펼친 것이다. Query string은 route 매칭에서는 제외했지만 표에는 보존했다. `upload`는 실제 transport가 POST이므로 POST로 기록했다 (`frontend/app/composables/useApi.ts:298-312`).

| # | 파일:줄 | Method | 경로 문자열 | 조립 | wrapper | backend route name | 치환 |
|---:|---|---|---|---|---|---|---|
| 1 | `frontend/app/components/auth/EmailVerificationBanner.vue:75` | POST | `/api/v1/auth/resend-verification/` | 리터럴 | `useApi` | `resend_verification_email` | 기계적 |
| 2 | `frontend/app/components/bible/BibleHome.vue:339` | GET | `/api/v1/todos/bible/home-stats/` | 리터럴 | `useApi` | `bible-home-stats` | 기계적 |
| 3 | `frontend/app/components/bible/BibleHome.vue:365` | GET | `/api/v1/todos/schedules/today/?plan_id=${planId}` | 템플릿 리터럴 | `useApi` | `schedules-today` | 수동 |
| 4 | `frontend/app/components/bible/TongdokCertificationModal.vue:94` | GET | `/api/v1/todos/certification/progress/` | 리터럴 | `useApi` | `certification-progress` | 기계적 |
| 5 | `frontend/app/components/calendar/MultiPlanCalendar.vue:227` | GET | `/api/v1/accounts/profile/${props.userId}/calendar/` | 템플릿 리터럴 | `useApi` | `get_user_calendar` | 기계적 |
| 6 | `frontend/app/components/CreateGroupModal.vue:124` | GET | `/api/v1/todos/plans/` | 리터럴 | `useApi` | `available-plans` | 기계적 |
| 7 | `frontend/app/components/IntroListContent.vue:268` | GET | `/api/v1/todos/user/video/intro/`<br>`/api/v1/todos/video/intro/` | 변수/조건식 | `useApi` | `user-video-intros`<br>`video-intro-list` | 수동 |
| 8 | `frontend/app/components/IntroListContent.vue:376` | POST | `/api/v1/todos/video/intro/progress/` | 리터럴 | `useApi` | `update-video-intro-progress` | 기계적 |
| 9 | `frontend/app/composables/bible/bibleFetchClient.ts:83` | GET | `/api/v1/bible-cache/${version}/${book}/${chapter}/` | 템플릿 리터럴 | 원시 `fetch` (`fetchWithTimeout`) | `bible-cache-content` | 구조 변경 |
| 10 | `frontend/app/composables/bible/bibleFetchClient.ts:112` | GET | `/api/v1/bible-cache/versions/` | 템플릿 리터럴 | 원시 `fetch` (`fetchWithTimeout`) | `bible-cache-versions` | 구조 변경 |
| 11 | `frontend/app/composables/useAuthService.ts:164` | GET | `/api/v1/auth/user/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `get_user` | 구조 변경 |
| 12 | `frontend/app/composables/useAuthService.ts:194` | POST | `/api/v1/auth/logout/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `logout` | 구조 변경 |
| 13 | `frontend/app/composables/useAuthService.ts:215` | POST | `/api/v1/auth/token/refresh/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `token_refresh` | 구조 변경 |
| 14 | `frontend/app/composables/useAuthService.ts:333` | POST | `/api/v1/auth/token/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `token_obtain_pair` | 구조 변경 |
| 15 | `frontend/app/composables/useAuthService.ts:377` | POST | `/api/v1/auth/social-login/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `social_login` | 구조 변경 |
| 16 | `frontend/app/composables/useAuthService.ts:448` | POST | `/api/v1/auth/complete-social-signup/` | 리터럴 | 기타: `useAuthService.apiRequest -> fetch` | `complete_social_signup` | 구조 변경 |
| 17 | `frontend/app/composables/useBookmark.ts:30` | GET | `/api/v1/todos/bible/bookmarks/by-chapter/` | 리터럴 | `useApi` | `bible-bookmark-by-chapter` | 기계적 |
| 18 | `frontend/app/composables/useBookmark.ts:67` | POST | `/api/v1/todos/bible/bookmarks/` | 리터럴 | `useApi` | `bible-bookmark-list` | 기계적 |
| 19 | `frontend/app/composables/useBookmark.ts:92` | DELETE | `/api/v1/todos/bible/bookmarks/${bookmarkId}/` | 템플릿 리터럴 | `useApi` | `bible-bookmark-detail` | 기계적 |
| 20 | `frontend/app/composables/useBookmark.ts:138` | GET | `/api/v1/todos/bible/bookmarks/` | 리터럴 | `useApi` | `bible-bookmark-list` | 기계적 |
| 21 | `frontend/app/composables/useCatchup.ts:143` | GET | `/api/v1/todos/subscriptions/${id}/catchup-status/` | 템플릿 리터럴 | `useApi` | `catchup-status` | 기계적 |
| 22 | `frontend/app/composables/useCatchup.ts:164` | POST | `/api/v1/todos/subscriptions/${id}/catchup/preview/` | 템플릿 리터럴 | `useApi` | `catchup-preview` | 기계적 |
| 23 | `frontend/app/composables/useCatchup.ts:184` | POST | `/api/v1/todos/subscriptions/${id}/catchup/` | 템플릿 리터럴 | `useApi` | `catchup-create` | 기계적 |
| 24 | `frontend/app/composables/useCatchup.ts:200` | GET | `/api/v1/todos/catchup-sessions/active/` | 리터럴 | `useApi` | `catchup-sessions-active` | 기계적 |
| 25 | `frontend/app/composables/useCatchup.ts:215` | GET | `/api/v1/todos/catchup-sessions/${sessionId}/` | 템플릿 리터럴 | `useApi` | `catchup-session-detail` | 기계적 |
| 26 | `frontend/app/composables/useCatchup.ts:233` | GET | `/api/v1/todos/catchup-sessions/${sessionId}/schedules/?date=${date}`<br>`/api/v1/todos/catchup-sessions/${sessionId}/schedules/` | 변수/조건식 | `useApi` | `catchup-session-schedules` | 수동 |
| 27 | `frontend/app/composables/useCatchup.ts:248` | POST | `/api/v1/todos/catchup-schedules/${scheduleId}/toggle/` | 템플릿 리터럴 | `useApi` | `catchup-schedule-toggle` | 기계적 |
| 28 | `frontend/app/composables/useCatchup.ts:263` | POST | `/api/v1/todos/catchup-sessions/${sessionId}/complete/` | 템플릿 리터럴 | `useApi` | `catchup-session-complete` | 기계적 |
| 29 | `frontend/app/composables/useCatchup.ts:278` | POST | `/api/v1/todos/catchup-sessions/${sessionId}/abandon/` | 템플릿 리터럴 | `useApi` | `catchup-session-abandon` | 기계적 |
| 30 | `frontend/app/composables/useCatchup.ts:293` | PATCH | `/api/v1/todos/catchup-sessions/${sessionId}/update/` | 템플릿 리터럴 | `useApi` | `catchup-session-update` | 기계적 |
| 31 | `frontend/app/composables/useHighlight.ts:66` | GET | `/api/v1/todos/bible/highlights/` | 리터럴 | `useApi` | `bible-highlight-list` | 기계적 |
| 32 | `frontend/app/composables/useHighlight.ts:86` | GET | `/api/v1/todos/bible/highlights/by-chapter/` | 리터럴 | `useApi` | `bible-highlight-by-chapter` | 기계적 |
| 33 | `frontend/app/composables/useHighlight.ts:122` | POST | `/api/v1/todos/bible/highlights/` | 리터럴 | `useApi` | `bible-highlight-list` | 기계적 |
| 34 | `frontend/app/composables/useHighlight.ts:149` | PUT | `/api/v1/todos/bible/highlights/${id}/` | 템플릿 리터럴 | `useApi` | `bible-highlight-detail` | 기계적 |
| 35 | `frontend/app/composables/useHighlight.ts:176` | DELETE | `/api/v1/todos/bible/highlights/${id}/` | 템플릿 리터럴 | `useApi` | `bible-highlight-detail` | 기계적 |
| 36 | `frontend/app/composables/useNote.ts:35` | GET | `/api/v1/todos/bible/notes/` | 리터럴 | `useApi` | `reflection-note-list` | 기계적 |
| 37 | `frontend/app/composables/useNote.ts:54` | GET | `/api/v1/todos/bible/notes/by-chapter/` | 리터럴 | `useApi` | `reflection-note-by-chapter` | 기계적 |
| 38 | `frontend/app/composables/useNote.ts:74` | GET | `/api/v1/todos/bible/notes/${id}/` | 템플릿 리터럴 | `useApi` | `reflection-note-detail` | 기계적 |
| 39 | `frontend/app/composables/useNote.ts:103` | POST | `/api/v1/todos/bible/notes/` | 리터럴 | `useApi` | `reflection-note-list` | 기계적 |
| 40 | `frontend/app/composables/useNote.ts:128` | PATCH | `/api/v1/todos/bible/notes/${id}/` | 템플릿 리터럴 | `useApi` | `reflection-note-detail` | 기계적 |
| 41 | `frontend/app/composables/useNote.ts:163` | DELETE | `/api/v1/todos/bible/notes/${id}/` | 템플릿 리터럴 | `useApi` | `reflection-note-detail` | 기계적 |
| 42 | `frontend/app/composables/usePersonalRecord.ts:44` | GET | `/api/v1/todos/bible/personal-records/by-book/` | 리터럴 | `useApi` | `personal-record-by-book` | 기계적 |
| 43 | `frontend/app/composables/usePersonalRecord.ts:72` | POST | `/api/v1/todos/bible/personal-records/` | 리터럴 | `useApi` | `personal-record-list` | 기계적 |
| 44 | `frontend/app/composables/usePlanApi.ts:36` | GET | `/api/v1/todos/plans/user/` | 리터럴 | `usePlanApi -> useApi` | `user-plans` | 기계적 |
| 45 | `frontend/app/composables/usePlanApi.ts:60` | GET | `/api/v1/todos/plan/` | 리터럴 | `usePlanApi -> useApi` | `plan-subscription-list` | 기계적 |
| 46 | `frontend/app/composables/usePlanApi.ts:81` | POST | `/api/v1/todos/plan/` | 리터럴 | `usePlanApi -> useApi` | `plan-subscription-list` | 기계적 |
| 47 | `frontend/app/composables/usePlanApi.ts:94` | POST | `/api/v1/todos/plan/${subscriptionId}/toggle-active/` | 템플릿 리터럴 | `usePlanApi -> useApi` | `plan-subscription-toggle-active` | 기계적 |
| 48 | `frontend/app/composables/usePlanApi.ts:107` | DELETE | `/api/v1/todos/plan/${subscriptionId}/` | 템플릿 리터럴 | `usePlanApi -> useApi` | `plan-subscription-detail` | 기계적 |
| 49 | `frontend/app/composables/useReadingPosition.ts:144` | GET | `/api/v1/todos/bible/reading-position/` | 리터럴 | `useApi` | `reading-position` | 기계적 |
| 50 | `frontend/app/composables/useReadingPosition.ts:222` | POST | `/api/v1/todos/bible/reading-position/` | 리터럴 | `useApi` | `reading-position` | 기계적 |
| 51 | `frontend/app/composables/useScheduleApi.ts:45` | GET | `/api/v1/todos/schedules/month/` | 리터럴 | `useScheduleApi -> useApi` | `schedules-month` | 기계적 |
| 52 | `frontend/app/composables/useScheduleApi.ts:67` | GET | `/api/v1/todos/next-position/` | 리터럴 | `useScheduleApi -> useApi` | `next-reading-position` | 기계적 |
| 53 | `frontend/app/composables/useScheduleApi.ts:88` | GET | `/api/v1/todos/detail/` | 리터럴 | `useScheduleApi -> useApi` | `chapter-detail` | 기계적 |
| 54 | `frontend/app/composables/useScheduleApi.ts:107` | POST | `/api/v1/todos/reading/update/` | 리터럴 | `useScheduleApi -> useApi` | `update_bible_progress` | 기계적 |
| 55 | `frontend/app/composables/useTongdokMode.ts:274` | GET | `/api/v1/todos/detail/` | 리터럴 | `useApi` | `chapter-detail` | 기계적 |
| 56 | `frontend/app/composables/useTongdokMode.ts:395` | POST | `/api/v1/todos/reading/update/` | 리터럴 | `useApi` | `update_bible_progress` | 기계적 |
| 57 | `frontend/app/pages/account/settings.vue:569` | GET | `/api/v1/auth/linked-accounts/` | 리터럴 | `useApi` | `get_linked_accounts` | 기계적 |
| 58 | `frontend/app/pages/account/settings.vue:583` | POST | `/api/v1/auth/oauth/link-state/` | 리터럴 | `useApi` | `issue_oauth_link_state` | 기계적 |
| 59 | `frontend/app/pages/account/settings.vue:658` | POST | `/api/v1/auth/unlink-social/` | 리터럴 | `useApi` | `unlink_social_account` | 기계적 |
| 60 | `frontend/app/pages/account/settings.vue:696` | POST | `/api/v1/auth/set-password/` | 리터럴 | `useApi` | `set_password` | 기계적 |
| 61 | `frontend/app/pages/account/settings.vue:730` | POST | `/api/v1/auth/resend-verification/` | 리터럴 | `useApi` | `resend_verification_email` | 기계적 |
| 62 | `frontend/app/pages/account/settings.vue:791` | POST | `/api/v1/auth/logout-all/` | 리터럴 | `useApi` | `logout_all_devices` | 기계적 |
| 63 | `frontend/app/pages/account/settings.vue:828` | POST | `/api/v1/auth/delete-account/` | 리터럴 | `useApi` | `delete_account` | 기계적 |
| 64 | `frontend/app/pages/account/settings.vue:862` | POST | `/api/v1/auth/merge-accounts/` | 리터럴 | `useApi` | `merge_accounts` | 기계적 |
| 65 | `frontend/app/pages/admin/hasena/index.vue:155` | GET | `/api/v1/todos/hasena/summaries/?page=${page.value}&page_size=${pageSize}` | 템플릿 리터럴 | `useApi` | `hasena-summaries-list` | 수동 |
| 66 | `frontend/app/pages/admin/hasena/index.vue:182` | POST | `/api/v1/todos/hasena/summaries/regenerate/` | 리터럴 | `useApi` | `hasena-summary-regenerate` | 기계적 |
| 67 | `frontend/app/pages/admin/hasena/index.vue:206` | GET | `/api/v1/todos/hasena/summary/?video_id=${videoId}` | 템플릿 리터럴 | `useApi` | `hasena-summary` | 수동 |
| 68 | `frontend/app/pages/admin/hasena/index.vue:226` | PUT | `/api/v1/todos/hasena/summaries/${editForm.value.video_id}/` | 템플릿 리터럴 | `useApi` | `hasena-summary-update` | 기계적 |
| 69 | `frontend/app/pages/admin/plans/index.vue:540` | GET | `/api/v1/todos/bible-plans/` | 리터럴 | `useApi` | `biblereadingplan-list` | 기계적 |
| 70 | `frontend/app/pages/admin/plans/index.vue:578` | PUT | `/api/v1/todos/bible-plans/${editingPlan.value.id}/` | 템플릿 리터럴 | `useApi` | `biblereadingplan-detail` | 기계적 |
| 71 | `frontend/app/pages/admin/plans/index.vue:582` | POST | `/api/v1/todos/bible-plans/` | 리터럴 | `useApi` | `biblereadingplan-list` | 기계적 |
| 72 | `frontend/app/pages/admin/plans/index.vue:611` | PATCH | `/api/v1/todos/bible-plans/${p.id}/` | 템플릿 리터럴 | `useApi` | `biblereadingplan-detail` | 기계적 |
| 73 | `frontend/app/pages/admin/plans/index.vue:618` | PATCH | `/api/v1/todos/bible-plans/${plan.id}/` | 템플릿 리터럴 | `useApi` | `biblereadingplan-detail` | 기계적 |
| 74 | `frontend/app/pages/admin/plans/index.vue:641` | PATCH | `/api/v1/todos/bible-plans/${plan.id}/` | 템플릿 리터럴 | `useApi` | `biblereadingplan-detail` | 기계적 |
| 75 | `frontend/app/pages/admin/plans/index.vue:818` | GET | `/api/v1/todos/schedules/?plan_id=${planId}` | 변수/조건식 | `useApi` | `schedule-list` | 수동 |
| 76 | `frontend/app/pages/admin/plans/index.vue:881` | POST | `/api/v1/todos/schedules/upload-excel/` | 리터럴 | `useApi` | `upload-schedules-excel` | 기계적 |
| 77 | `frontend/app/pages/admin/plans/index.vue:939` | DELETE | `/api/v1/todos/schedules/${scheduleId}/` | 템플릿 리터럴 | `useApi` | `schedule-detail` | 기계적 |
| 78 | `frontend/app/pages/admin/plans/index.vue:967` | PUT | `/api/v1/todos/schedules/${editingSchedule.value.id}/` | 템플릿 리터럴 | `useApi` | `schedule-detail` | 기계적 |
| 79 | `frontend/app/pages/admin/plans/index.vue:974` | POST | `/api/v1/todos/schedules/` | 리터럴 | `useApi` | `schedule-list` | 기계적 |
| 80 | `frontend/app/pages/admin/video/intro.vue:255` | GET | `/api/v1/todos/bible-plans/` | 리터럴 | `useApi` | `biblereadingplan-list` | 기계적 |
| 81 | `frontend/app/pages/admin/video/intro.vue:285` | GET | `/api/v1/todos/video/intro/?plan_id=${selectedPlanId.value}`<br>`/api/v1/todos/video/intro/` | 변수/조건식 | `useApi` | `video-intro-list` | 수동 |
| 82 | `frontend/app/pages/admin/video/intro.vue:316` | DELETE | `/api/v1/todos/video/intro/${id}/` | 템플릿 리터럴 | `useApi` | `video-intro-detail` | 기계적 |
| 83 | `frontend/app/pages/admin/video/intro.vue:403` | POST | `/api/v1/todos/video/intro/upload/` | 리터럴 | `useApi` | `upload-video-intros` | 기계적 |
| 84 | `frontend/app/pages/auth/[provider]/callback.vue:132` | POST | `/api/v1/auth/link-social/` | 리터럴 | `useApi` | `link_social_account` | 기계적 |
| 85 | `frontend/app/pages/auth/[provider]/callback.vue:224` | POST | `/api/v1/auth/social-login/v2/` | 리터럴 | `useApi` | `social_login_v2` | 기계적 |
| 86 | `frontend/app/pages/auth/[provider]/callback.vue:299` | POST | `/api/v1/auth/social-login/v2/` | 리터럴 | `useApi` | `social_login_v2` | 기계적 |
| 87 | `frontend/app/pages/auth/forgot-password.vue:100` | POST | `/api/v1/auth/request-password-reset/` | 리터럴 | `useApi` | `request_password_reset` | 기계적 |
| 88 | `frontend/app/pages/auth/google/setup.vue:132` | POST | `/api/v1/auth/check-nickname/` | 리터럴 | `useApi` | `check_nickname` | 기계적 |
| 89 | `frontend/app/pages/auth/google/setup.vue:187` | POST | `/api/v1/auth/complete-social-signup/` | 리터럴 | `useApi` | `complete_social_signup` | 기계적 |
| 90 | `frontend/app/pages/auth/kakao/setup.vue:135` | POST | `/api/v1/auth/check-nickname/` | 리터럴 | `useApi` | `check_nickname` | 기계적 |
| 91 | `frontend/app/pages/auth/kakao/setup.vue:190` | POST | `/api/v1/auth/complete-social-signup/` | 리터럴 | `useApi` | `complete_social_signup` | 기계적 |
| 92 | `frontend/app/pages/auth/reset-password.vue:133` | POST | `/api/v1/auth/verify-reset-token/` | 리터럴 | `useApi` | `verify_reset_token` | 기계적 |
| 93 | `frontend/app/pages/auth/reset-password.vue:155` | POST | `/api/v1/auth/reset-password/` | 리터럴 | `useApi` | `reset_password` | 기계적 |
| 94 | `frontend/app/pages/auth/verify-email.vue:85` | POST | `/api/v1/auth/verify-email/` | 리터럴 | `useApi` | `verify_email` | 기계적 |
| 95 | `frontend/app/pages/auth/verify-email.vue:113` | POST | `/api/v1/auth/send-verification/` | 리터럴 | `useApi` | `send_verification_email` | 기계적 |
| 96 | `frontend/app/pages/bible/bookmarks.vue:156` | DELETE | `/api/v1/todos/bible/bookmarks/${bookmark.id}/` | 템플릿 리터럴 | `useApi` | `bible-bookmark-detail` | 기계적 |
| 97 | `frontend/app/pages/bible/history.vue:174` | GET | `/api/v1/todos/bible/personal-records/stats/` | 리터럴 | `useApi` | `personal-record-stats` | 기계적 |
| 98 | `frontend/app/pages/bible/history.vue:181` | GET | `/api/v1/todos/bible/personal-records/dates/` | 리터럴 | `useApi` | `personal-record-dates` | 기계적 |
| 99 | `frontend/app/pages/bible/search.vue:190` | GET | `/api/v1/bible-cache/search/` | 리터럴 | `useApi` | `bible-cache-search` | 기계적 |
| 100 | `frontend/app/pages/bible/settings.vue:411` | DELETE | `/api/v1/todos/bible/bookmarks/delete-all/` | 리터럴 | `useApi` | `bible-bookmark-delete-all` | 기계적 |
| 101 | `frontend/app/pages/bible/settings.vue:438` | DELETE | `/api/v1/todos/bible/notes/delete-all/` | 리터럴 | `useApi` | `reflection-note-delete-all` | 기계적 |
| 102 | `frontend/app/pages/bible/settings.vue:465` | DELETE | `/api/v1/todos/bible/highlights/delete-all/` | 리터럴 | `useApi` | `bible-highlight-delete-all` | 기계적 |
| 103 | `frontend/app/pages/friends.vue:170` | GET | `/api/v1/accounts/friends/` | 리터럴 | `useApi` | `get_friends` | 기계적 |
| 104 | `frontend/app/pages/friends.vue:191` | GET | `/api/v1/accounts/followers/${auth.user.value.id}/` | 템플릿 리터럴 | `useApi` | `get_followers` | 기계적 |
| 105 | `frontend/app/pages/friends.vue:206` | GET | `/api/v1/accounts/following/${auth.user.value.id}/` | 템플릿 리터럴 | `useApi` | `get_following` | 기계적 |
| 106 | `frontend/app/pages/friends.vue:224` | GET | `/api/v1/accounts/search/` | 리터럴 | `useApi` | `search_users` | 기계적 |
| 107 | `frontend/app/pages/hasena.vue:299` | GET | `/api/v1/todos/hasena/summary/?video_id=${latestVideoId.value}` | 템플릿 리터럴 | `useApi` | `hasena-summary` | 수동 |
| 108 | `frontend/app/pages/hasena.vue:332` | POST | `/api/v1/todos/hasena/summaries/regenerate/` | 리터럴 | `useApi` | `hasena-summary-regenerate` | 기계적 |
| 109 | `frontend/app/pages/hasena.vue:338` | GET | `/api/v1/todos/hasena/summary/?video_id=${latestVideoId.value}&generate=true` | 템플릿 리터럴 | `useApi` | `hasena-summary` | 수동 |
| 110 | `frontend/app/pages/hasena.vue:376` | GET | `/api/v1/todos/hasena/day/` | 리터럴 | `useApi` | `hasena-day` | 기계적 |
| 111 | `frontend/app/pages/intro.vue:172` | GET | `/api/v1/todos/video/intro/${videoIntroId.value}/` | 템플릿 리터럴 | `useApi` | `video-intro-detail` | 기계적 |
| 112 | `frontend/app/pages/intro.vue:193` | GET | `/api/v1/todos/user/video/intro/` | 리터럴 | `useApi` | `user-video-intros` | 기계적 |
| 113 | `frontend/app/pages/intro.vue:252` | POST | `/api/v1/todos/video/intro/progress/` | 리터럴 | `useApi` | `update-video-intro-progress` | 기계적 |
| 114 | `frontend/app/pages/login.vue:160` | POST | `/api/v1/auth/email-login/` | 리터럴 | `useApi` | `email_login` | 기계적 |
| 115 | `frontend/app/pages/register-email.vue:205` | POST | `/api/v1/auth/check-nickname/` | 리터럴 | `useApi` | `check_nickname` | 기계적 |
| 116 | `frontend/app/pages/register-email.vue:256` | POST | `/api/v1/auth/email-register/` | 리터럴 | `useApi` | `email_register` | 기계적 |
| 117 | `frontend/app/pages/register-email.vue:270` | POST | `/api/v1/auth/send-verification/` | 리터럴 | `useApi` | `send_verification_email` | 기계적 |
| 118 | `frontend/app/pages/register.vue:143` | POST | `/api/v1/auth/check-username/` | 리터럴 | `useApi` | `check_username` | 기계적 |
| 119 | `frontend/app/pages/register.vue:164` | POST | `/api/v1/auth/check-nickname/` | 리터럴 | `useApi` | `check_nickname` | 기계적 |
| 120 | `frontend/app/stores/calendarDisplay.ts:131` | GET | `/api/v1/todos/calendar/settings/` | 리터럴 | `useApi` | `calendar-settings` | 기계적 |
| 121 | `frontend/app/stores/calendarDisplay.ts:157` | PATCH | `/api/v1/todos/calendar/settings/${id}/` | 템플릿 리터럴 | `useApi` | `calendar-setting-detail` | 기계적 |
| 122 | `frontend/app/stores/calendarDisplay.ts:205` | POST | `/api/v1/todos/calendar/settings/reorder/` | 리터럴 | `useApi` | `calendar-settings-reorder` | 기계적 |
| 123 | `frontend/app/stores/calendarDisplay.ts:232` | GET | `/api/v1/todos/calendar/month/` | 리터럴 | `useApi` | `calendar-month` | 기계적 |
| 124 | `frontend/app/stores/calendarDisplay.ts:296` | GET | `/api/v1/todos/calendar/last-incomplete/` | 리터럴 | `useApi` | `calendar-last-incomplete` | 기계적 |
| 125 | `frontend/app/stores/catchup.ts:37` | GET | `/api/v1/todos/subscriptions/${subscriptionId}/catchup-status/` | 템플릿 리터럴 | `useApi` | `catchup-status` | 기계적 |
| 126 | `frontend/app/stores/catchup.ts:53` | GET | `/api/v1/todos/catchup-sessions/active/` | 리터럴 | `useApi` | `catchup-sessions-active` | 기계적 |
| 127 | `frontend/app/stores/catchup.ts:72` | GET | `/api/v1/todos/catchup-sessions/${activeSession.value.id}/schedules/?date=${today}` | 템플릿 리터럴 | `useApi` | `catchup-session-schedules` | 수동 |
| 128 | `frontend/app/stores/catchup.ts:92` | POST | `/api/v1/todos/catchup-schedules/${scheduleId}/toggle/` | 템플릿 리터럴 | `useApi` | `catchup-schedule-toggle` | 기계적 |
| 129 | `frontend/app/stores/catchup.ts:121` | POST | `/api/v1/todos/subscriptions/${subscriptionId}/catchup/` | 템플릿 리터럴 | `useApi` | `catchup-create` | 기계적 |
| 130 | `frontend/app/stores/catchup.ts:138` | POST | `/api/v1/todos/catchup-sessions/${activeSession.value.id}/complete/` | 템플릿 리터럴 | `useApi` | `catchup-session-complete` | 기계적 |
| 131 | `frontend/app/stores/catchup.ts:156` | POST | `/api/v1/todos/catchup-sessions/${activeSession.value.id}/abandon/` | 템플릿 리터럴 | `useApi` | `catchup-session-abandon` | 기계적 |
| 132 | `frontend/app/stores/catchup.ts:174` | PATCH | `/api/v1/todos/catchup-sessions/${activeSession.value.id}/update/` | 템플릿 리터럴 | `useApi` | `catchup-session-update` | 기계적 |
| 133 | `frontend/app/stores/catchup.ts:192` | POST | `/api/v1/todos/subscriptions/${subscriptionId}/catchup/preview/` | 템플릿 리터럴 | `useApi` | `catchup-preview` | 기계적 |
| 134 | `frontend/app/stores/groups.ts:124` | GET | `/api/v1/todos/groups/` | 리터럴 | `useApi` | `groups-list` | 기계적 |
| 135 | `frontend/app/stores/groups.ts:153` | GET | `/api/v1/todos/groups/${groupId}/` | 템플릿 리터럴 | `useApi` | `group-detail` | 기계적 |
| 136 | `frontend/app/stores/groups.ts:170` | GET | `/api/v1/todos/groups/${groupId}/members/` | 템플릿 리터럴 | `useApi` | `group-members` | 기계적 |
| 137 | `frontend/app/stores/groups.ts:188` | POST | `/api/v1/todos/groups/create/` | 리터럴 | `useApi` | `create-group` | 기계적 |
| 138 | `frontend/app/stores/groups.ts:203` | POST | `/api/v1/todos/groups/${groupId}/join/` | 템플릿 리터럴 | `useApi` | `join-group` | 기계적 |
| 139 | `frontend/app/stores/groups.ts:222` | POST | `/api/v1/todos/groups/${groupId}/leave/` | 템플릿 리터럴 | `useApi` | `leave-group` | 기계적 |
| 140 | `frontend/app/stores/groups.ts:243` | POST | `/api/v1/todos/groups/${groupId}/invite/` | 템플릿 리터럴 | `useApi` | `invite-to-group` | 기계적 |
| 141 | `frontend/app/stores/groups.ts:260` | GET | `/api/v1/todos/invitations/` | 리터럴 | `useApi` | `my-invitations` | 기계적 |
| 142 | `frontend/app/stores/groups.ts:272` | POST | `/api/v1/todos/invitations/${invitationId}/respond/` | 템플릿 리터럴 | `useApi` | `respond-invitation` | 기계적 |
| 143 | `frontend/app/stores/groups.ts:297` | GET | `/api/v1/todos/schedules/month/` | 리터럴 | `useApi` | `schedules-month` | 기계적 |
| 144 | `frontend/app/stores/groups.ts:324` | GET | `/api/v1/todos/groups/${groupId}/member-progress/` | 템플릿 리터럴 | `useApi` | `group-member-progress` | 기계적 |
| 145 | `frontend/app/stores/groups.ts:349` | GET | `/api/v1/todos/users/${userId}/groups/` | 템플릿 리터럴 | `useApi` | `user-public-groups` | 기계적 |
| 146 | `frontend/app/stores/groups.ts:364` | PATCH | `/api/v1/todos/groups/${groupId}/visibility/` | 템플릿 리터럴 | `useApi` | `group-visibility` | 기계적 |
| 147 | `frontend/app/stores/hasena.ts:74` | GET | `/api/v1/todos/hasena/status/` | 리터럴 | `useApi` | `hasena-user-status` | 기계적 |
| 148 | `frontend/app/stores/hasena.ts:95` | POST | `/api/v1/todos/hasena/update/` | 리터럴 | `useApi` | `hasena-record-update` | 기계적 |
| 149 | `frontend/app/stores/hasena.ts:132` | POST | `/api/v1/todos/hasena/update/` | 리터럴 | `useApi` | `hasena-record-update` | 기계적 |
| 150 | `frontend/app/stores/hasena.ts:166` | GET | `/api/v1/todos/hasena/?year=${year}&month=${month}` | 템플릿 리터럴 | `useApi` | `hasena-record-list` | 수동 |
| 151 | `frontend/app/stores/hasena.ts:177` | GET | `/api/v1/todos/hasena/calendar/?year=${year}&month=${month}` | 템플릿 리터럴 | `useApi` | `hasena-calendar` | 수동 |
| 152 | `frontend/app/stores/hasena.ts:207` | GET | `/api/v1/todos/hasena/stats/` | 리터럴 | `useApi` | `hasena-stats` | 기계적 |
| 153 | `frontend/app/stores/notifications.ts:85` | GET | `/api/v1/todos/notifications/` | 리터럴 | `useApi` | `notification-inbox` | 기계적 |
| 154 | `frontend/app/stores/notifications.ts:105` | GET | `/api/v1/todos/notifications/settings/` | 리터럴 | `useApi` | `notification-settings` | 기계적 |
| 155 | `frontend/app/stores/notifications.ts:127` | PATCH | `/api/v1/todos/notifications/${notificationId}/read/` | 템플릿 리터럴 | `useApi` | `notification-read` | 기계적 |
| 156 | `frontend/app/stores/notifications.ts:148` | POST | `/api/v1/todos/notifications/mark-all-read/` | 리터럴 | `useApi` | `notifications-mark-all-read` | 기계적 |
| 157 | `frontend/app/stores/notifications.ts:160` | PATCH | `/api/v1/todos/notifications/settings/` | 리터럴 | `useApi` | `notification-settings` | 기계적 |
| 158 | `frontend/app/stores/profile.ts:88` | GET | `/api/v1/accounts/profile/${userId}/` | 템플릿 리터럴 | `useApi` | `get_user_profile` | 기계적 |
| 159 | `frontend/app/stores/profile.ts:103` | PUT | `/api/v1/accounts/profile/` | 리터럴 | `useApi` | `update_user_profile` | 기계적 |
| 160 | `frontend/app/stores/profile.ts:121` | GET | `/api/v1/accounts/profile/${userId}/achievements/` | 템플릿 리터럴 | `useApi` | `get_user_achievements` | 기계적 |
| 161 | `frontend/app/stores/profile.ts:133` | GET | `/api/v1/accounts/profile/${userId}/calendar/` | 템플릿 리터럴 | `useApi` | `get_user_calendar` | 기계적 |
| 162 | `frontend/app/stores/readingSettings.ts:237` | GET | `/api/v1/accounts/reading-settings/` | 리터럴 | `useApi` | `get_reading_settings` | 기계적 |
| 163 | `frontend/app/stores/readingSettings.ts:281` | PATCH | `/api/v1/accounts/reading-settings/update/` | 리터럴 | `useApi` | `update_reading_settings` | 기계적 |
| 164 | `frontend/app/stores/scoreboard.ts:126` | GET | `/api/v1/todos/scoreboard/` | 리터럴 | `useApi` | `scoreboard` | 기계적 |
| 165 | `frontend/app/stores/scoreboard.ts:151` | GET | `/api/v1/todos/scoreboard/friends/` | 리터럴 | `useApi` | `friends-scoreboard` | 기계적 |
| 166 | `frontend/app/stores/scoreboard.ts:180` | GET | `/api/v1/todos/scoreboard/group/${groupId}/` | 템플릿 리터럴 | `useApi` | `group-scoreboard` | 기계적 |
| 167 | `frontend/app/stores/scoreboard.ts:201` | GET | `/api/v1/todos/scoreboard/my-ranking/` | 리터럴 | `useApi` | `my-ranking` | 기계적 |
| 168 | `frontend/app/stores/social.ts:46` | GET | `/api/v1/accounts/followers/${userId}/` | 템플릿 리터럴 | `useApi` | `get_followers` | 기계적 |
| 169 | `frontend/app/stores/social.ts:65` | GET | `/api/v1/accounts/following/${userId}/` | 템플릿 리터럴 | `useApi` | `get_following` | 기계적 |
| 170 | `frontend/app/stores/social.ts:84` | GET | `/api/v1/accounts/friends/` | 리터럴 | `useApi` | `get_friends` | 기계적 |
| 171 | `frontend/app/stores/social.ts:116` | POST | `/api/v1/accounts/follow/` | 리터럴 | `useApi` | `follow_user` | 기계적 |
| 172 | `frontend/app/stores/social.ts:145` | DELETE | `/api/v1/accounts/unfollow/${userId}/` | 템플릿 리터럴 | `useApi` | `unfollow_user` | 기계적 |
| 173 | `frontend/app/stores/social.ts:172` | GET | `/api/v1/accounts/search/` | 리터럴 | `useApi` | `search_users` | 기계적 |
| 174 | `frontend/app/stores/subscription.ts:41` | GET | `/api/v1/todos/plans/user/` | 리터럴 | `useApi` | `user-plans` | 기계적 |
| 175 | `frontend/app/stores/subscription.ts:55` | POST | `/api/v1/todos/plan/${subscriptionId}/toggle-active/` | 템플릿 리터럴 | `useApi` | `plan-subscription-toggle-active` | 기계적 |
| 176 | `frontend/app/stores/subscription.ts:73` | POST | `/api/v1/todos/plan/` | 리터럴 | `useApi` | `plan-subscription-list` | 기계적 |
| 177 | `frontend/app/utils/devicePushRuntime.ts:77` | POST | `/api/v1/todos/notifications/push/subscriptions/remove/` | 리터럴 | `useApi` | `notification-push-remove` | 기계적 |
| 178 | `frontend/app/utils/devicePushRuntime.ts:84` | GET | `/api/v1/todos/notifications/push/config/` | 리터럴 | `useApi` | `notification-push-config` | 기계적 |
| 179 | `frontend/app/utils/devicePushRuntime.ts:93` | POST | `/api/v1/todos/notifications/push/subscriptions/` | 리터럴 | `useApi` | `notification-push-register` | 기계적 |
| 180 | `frontend/server/api/cron/hasena-summary.get.ts:66` | POST | `/api/v1/todos/hasena/summary/cron/` | 템플릿 리터럴 | 원시 `fetch` | `hasena-summary-cron` | 구조 변경 |

## 3. 매칭되지 않는 surface

### 3.1 프론트가 호출하지만 Django에 없는 경로: 0

180개 호출의 모든 경로 대안을 resolver template에 매칭했다. HTTP method도 callback 허용 method에 모두 포함되어 경로 오타, 삭제 API 호출, method mismatch는 현재 실행 코드에서 발견되지 않았다. `useApi.ts`의 guard/allowlist에만 남은 `/api/v1/todos/user/`, `/api/v1/auth/register/`, `/api/v1/auth/complete-kakao-signup/`, `/api/v1/auth/verify/` 등은 **호출이 아니므로** 이 0건 판정에 넣지 않았다 (`frontend/app/composables/useApi.ts:169-183,214-230`).

### 3.2 Django에는 있지만 프론트가 호출하지 않는 route: 27

`{auth|accounts}`는 동일 account callback의 두 mount를 한 canonical template로 표시한다. Mobile 검색 범위는 `mobile/`의 실행 소스이며, 테스트의 `/api/v1/todos/` 문자열은 소비로 세지 않았다 (`mobile/test/webviewNavigation.test.cjs:69`). **mobile 전용 2건**, **web/mobile 모두 직접 사용하지 않는 25건**이다. 후자에서 "죽은 코드"는 정적 grep만으로 확정할 수 없으므로 확정하지 않았다.

등록 pattern을 문자 그대로 세면 미호출은 **97 / 225개**다. 구성은 아래 canonical 미사용 27개 + account 반대-prefix alias 47개 + DRF format-suffix variant 23개다. 자동생성 client 관점에서 의미 있는 operation 누락을 보여 주기 위해 아래 표는 중복을 접은 27개를 전수 기재한다 (`backend/config/urls.py:25-28`; `backend/todos/urls.py:5-13`).

| canonical route template | route name | web/mobile 판정 | backend 근거 |
|---|---|---|---|
| `/api/v1/bible-cache/<str:version>/<str:book>/<int:chapter>/status/` | `bible-cache-status` | web/mobile 미사용; cache status endpoint (외부 사용 여부 미확정) | `backend/bible_cache/urls.py:19-23` |
| `/api/v1/todos/` | `api-root` | web/mobile 기능 호출 없음; DRF router root | `backend/todos/urls.py:5-13` |
| `/api/v1/todos/bible-plans/<str:pk>/schedules/` | `biblereadingplan-schedules` | web/mobile 미사용; staff ViewSet action (죽은 코드 여부 미확정) | `backend/todos/urls.py:6; backend/todos/views.py:1252-1258` |
| `/api/v1/todos/bible-plans/<str:pk>/set_default/` | `biblereadingplan-set-default` | web/mobile 미사용; staff ViewSet action (죽은 코드 여부 미확정) | `backend/todos/urls.py:6; backend/todos/views.py:1239-1250` |
| `/api/v1/todos/bible-plans/<str:pk>/toggle_active/` | `biblereadingplan-toggle-active` | web/mobile 미사용; staff ViewSet action (죽은 코드 여부 미확정) | `backend/todos/urls.py:6; backend/todos/views.py:1227-1237` |
| `/api/v1/todos/bible/personal-records/<str:pk>/` | `personal-record-detail` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:10` |
| `/api/v1/todos/hasena/<int:pk>/` | `hasena-record-detail` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:55` |
| `/api/v1/todos/hasena/sync/` | `hasena-sync` | web/mobile 미사용; cron-secret endpoint (외부 scheduler 사용 여부 미확정) | `backend/todos/urls.py:60` |
| `/api/v1/todos/plan/<int:pk>/progress/` | `plan-subscription-progress` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:40` |
| `/api/v1/todos/plan/<int:pk>/unsubscribe/` | `plan-subscription-unsubscribe` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:41` |
| `/api/v1/todos/reading/` | `update_bible_progress` | web/mobile 미사용; 동일 콜백 별칭 `reading/update/`는 FE 2곳 사용 | `backend/todos/urls.py:21` |
| `/api/v1/todos/reading/history/` | `progress-history` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:23` |
| `/api/v1/todos/stats/plan/` | `plan-stats` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:70` |
| `/api/v1/todos/stats/progress/` | `progress-stats` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:71` |
| `/api/v1/todos/stats/users/` | `total-users` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:69` |
| `/api/v1/todos/stats/visitors/` | `visitor-stats` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:72` |
| `/api/v1/todos/stats/visitors/increment/` | `increment-visitor-count` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/todos/urls.py:73` |
| `/api/v1/{auth\|accounts}/account-email/` | `account_email` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:61` |
| `/api/v1/{auth\|accounts}/complete-kakao-signup/` | `complete_kakao_signup` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:23` |
| `/api/v1/{auth\|accounts}/csrf/` | `csrf_token` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:12` |
| `/api/v1/{auth\|accounts}/login/` | `login` | web/mobile 미사용; 동일 token view의 `token/`은 FE 1곳 사용 | `backend/accounts/urls.py:17` |
| `/api/v1/{auth\|accounts}/notification-settings/` | `notification_settings` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:62` |
| `/api/v1/{auth\|accounts}/refresh/` | `token_refresh_legacy` | web/mobile 미사용; 동일 refresh view의 `token/refresh/`는 FE 1곳, mobile 1곳 사용 | `backend/accounts/urls.py:18` |
| `/api/v1/{auth\|accounts}/register/` | `register` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:16` |
| `/api/v1/{auth\|accounts}/session/consume/` | `session_bridge_consume` | mobile 전용: WebView 이동 URL (`mobile/App.tsx:160-164,172-180`) | `backend/accounts/urls.py:97` |
| `/api/v1/{auth\|accounts}/session/issue/` | `session_bridge_issue` | mobile 전용: `fetch` 사용 (`mobile/App.tsx:141-147`) | `backend/accounts/urls.py:96` |
| `/api/v1/{auth\|accounts}/verify/` | `verify_auth` | web/mobile 미사용 (죽은 코드 여부 미확정) | `backend/accounts/urls.py:13` |

### 3.3 같은 기능/콜백의 경로 중복

- **정확한 route-name 기준으로 프론트가 둘 이상의 등록 경로를 동시에 쓰는 경우는 0건**이다. 즉 같은 suffix를 `/auth/`와 `/accounts/` 양쪽으로 호출하는 사례도 없다.
- 그러나 backend는 account URL 47개를 두 prefix에 모두 mount한다 (`backend/config/urls.py:25-26`). 프론트 호출은 `/auth/` **33곳 / 12파일 / 25 route template**, `/accounts/` **17곳 / 5파일 / 12 route template**로 기능군에 따라 갈라져 있다. 자동생성 시 같은 callback operation이 두 벌 생성되는 구조이므로 canonical prefix 결정이 필요하다.
- backend 자체의 동일 콜백 별칭은 `/api/v1/todos/reading/`와 `/api/v1/todos/reading/update/` 2개다 (`backend/todos/urls.py:21-22`). 프론트는 후자만 **2곳**(`useScheduleApi.ts:107`, `useTongdokMode.ts:395`) 호출한다.

제품 기능 관점에서 이름이 겹치지만 callback/계약이 다른 수동 판단 후보는 다음과 같다. 아래는 "같은 backend route"라는 뜻이 아니다.

| 기능 후보 | 경로 A (FE 호출 수) | 경로 B (FE 호출 수) | 사실/판단점 |
|---|---|---|---|
| 소셜 로그인 | `/api/v1/auth/social-login/` (1곳) | `/api/v1/auth/social-login/v2/` (2곳) | 별도 callback인 legacy/v2. A는 `frontend/app/composables/useAuthService.ts:389`, B는 `frontend/app/pages/auth/[provider]/callback.vue:224,299` |
| 자격증명 로그인 | `/api/v1/auth/token/` (1곳) | `/api/v1/auth/email-login/` (1곳) | username/password와 email identifier 계약이 달라 단순 통합 불가 (`useAuthService.ts:333-337`; `pages/login.vue:158-164`) |
| 구독 조회 | `/api/v1/todos/plans/user/` (2곳) | `/api/v1/todos/plan/` (1곳) | 응답 shape가 달라 wrapper가 별도 정규화 (`usePlanApi.ts:31-72`; `stores/subscription.ts:36-46`) |

## 4. 경로 조립 방식

| 분류 | 건수 | 치환 영향 |
|---|---:|---|
| 문자열 리터럴 | **110** | method/path를 고정 operation으로 바로 치환 가능 |
| 템플릿 리터럴 | **66** | path parameter는 생성 client 인자로 옮김. 이 중 inline query는 query object로 분리 필요 |
| 변수/조건식 | **4** | identifier initializer와 분기를 판독해야 함: `IntroListContent.vue:258-268`, `useCatchup.ts:230-233`, `admin/plans/index.vue:816-818`, `admin/video/intro.vue:281-285` |
| **합계** | **180** | |

## 5. 자동생성 client 치환 난이도

| 등급 | 건수 | 판정 기준 | 대표 근거 |
|---|---:|---|---|
| 기계적 치환 가능 | **159** | `useApi` 계열 + 고정 path 또는 path-param template + inline query 없음 | `useBookmark.ts:30-92`, `stores/groups.ts:124-364` |
| 수동 판단 필요 | **12** | URL 변수/조건식 4건 또는 문자열 안에 query를 직접 조립한 호출. 생성 client의 query object/operation 분기로 옮겨야 함 | `useCatchup.ts:230-233`, `pages/hasena.vue:299,338` |
| 구조 변경 필요 | **9** | `useAuthService.apiRequest` 6건, bible cache raw transport 2건, server cron raw fetch 1건. cookie refresh/timeout/cache fallback/별도 base URL/cron secret 동작을 보존해야 함 | `useAuthService.ts:81-134`, `bibleFetchClient.ts:73-121`, `server/api/cron/hasena-summary.get.ts:60-73` |
| **합계** | **180** | | |

등급은 호출 표현식 단위다. `usePlanApi`/`useScheduleApi` 소비 파일의 고수준 method 호출은 실제 HTTP endpoint를 정의하는 위치가 아니므로 다시 세지 않았다. 생성 client 치환은 표의 wrapper 정의 지점에서 한 번 수행하면 그 소비자는 그대로 따라온다 (`frontend/app/composables/usePlanApi.ts:31-113`; `frontend/app/composables/useScheduleApi.ts:31-117`).

