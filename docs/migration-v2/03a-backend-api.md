# Backend API, Views and Serializers Specification (v2 Migration Target)

본 문서는 `maeil1dok` 백엔드(Django + Django REST Framework)의 API 엔드포인트, 뷰 클래스/함수 및 시리얼라이저 명세서입니다.

---

## 섹션 A: URL 패턴 전수

| HTTP 메서드 | URL 패턴 (풀패스) | 뷰 (함수명 또는 클래스명) | 파일:라인 | 인증 클래스 | 권한 클래스 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Accounts / Auth** | | | | | |
| `POST` | `/api/v1/auth/token/` | `CookieTokenObtainPairView` | `accounts/urls.py:9` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/token/refresh/` | `CookieTokenRefreshView` | `accounts/urls.py:10` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/logout/` | `cookie_logout` | `accounts/urls.py:11` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/auth/csrf/` | `get_csrf_token` | `accounts/urls.py:12` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/auth/verify/` | `verify_auth` | `accounts/urls.py:13` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/auth/register/` | `register` | `accounts/urls.py:16` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/login/` | `CookieTokenObtainPairView` | `accounts/urls.py:17` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/refresh/` | `CookieTokenRefreshView` | `accounts/urls.py:18` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/auth/user/` | `get_user` | `accounts/urls.py:19` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/auth/social-login/` | `social_login` | `accounts/urls.py:20` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/check-username/` | `check_username` | `accounts/urls.py:21` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/check-nickname/` | `check_nickname` | `accounts/urls.py:22` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/auth/complete-kakao-signup/` | `complete_kakao_signup` | `accounts/urls.py:23` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/profile/<int:user_id>/` | `get_user_profile` | `accounts/urls.py:26` | 없음 (기본값) | `AllowAny` |
| `PUT` | `/api/v1/accounts/profile/` | `update_user_profile` | `accounts/urls.py:27` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/accounts/profile/<int:user_id>/calendar/` | `get_user_calendar` | `accounts/urls.py:28` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/profile/<int:user_id>/achievements/` | `get_user_achievements` | `accounts/urls.py:29` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/follow/` | `follow_user` | `accounts/urls.py:32` | JWT Cookie / Header | `IsAuthenticated` |
| `DELETE` | `/api/v1/accounts/unfollow/<int:user_id>/` | `unfollow_user` | `accounts/urls.py:33` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/accounts/followers/<int:user_id>/` | `get_followers` | `accounts/urls.py:34` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/following/<int:user_id>/` | `get_following` | `accounts/urls.py:35` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/friends/` | `get_friends` | `accounts/urls.py:36` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/accounts/search/` | `search_users` | `accounts/urls.py:39` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/reading-settings/` | `get_reading_settings` | `accounts/urls.py:42` | JWT Cookie / Header | `IsAuthenticated` |
| `PATCH` | `/api/v1/accounts/reading-settings/update/` | `update_reading_settings` | `accounts/urls.py:43` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/email-register/` | `email_register` | `accounts/urls.py:48` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/email-login/` | `email_login` | `accounts/urls.py:49` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/social-login/v2/` | `social_login_v2` | `accounts/urls.py:54` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/complete-social-signup/` | `complete_social_signup` | `accounts/urls.py:55` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/accounts/linked-accounts/` | `get_linked_accounts` | `accounts/urls.py:60` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/link-social/` | `link_social_account` | `accounts/urls.py:61` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/unlink-social/` | `unlink_social_account` | `accounts/urls.py:62` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/set-password/` | `set_password` | `accounts/urls.py:63` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/logout-all/` | `logout_all_devices` | `accounts/urls.py:64` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/merge-accounts/` | `merge_accounts` | `accounts/urls.py:69` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/delete-account/` | `delete_account` | `accounts/urls.py:74` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/send-verification/` | `send_verification_email_view` | `accounts/urls.py:79` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/verify-email/` | `verify_email` | `accounts/urls.py:80` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/resend-verification/` | `resend_verification_email` | `accounts/urls.py:81` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/request-password-reset/` | `request_password_reset` | `accounts/urls.py:86` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/verify-reset-token/` | `verify_reset_token` | `accounts/urls.py:87` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/reset-password/` | `reset_password` | `accounts/urls.py:88` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/accounts/session/issue/` | `session_bridge_issue` | `accounts/urls.py:93` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/accounts/session/consume/` | `session_bridge_consume` | `accounts/urls.py:94` | 없음 (기본값) | `AllowAny` |
| **Schedules & Plans** | | | | | |
| `GET` | `/api/v1/todos/bible-plans/` | `BibleReadingPlanViewSet.list` | `todos/urls.py:6` | JWT Cookie / Header | `IsAuthenticated` (Staff/Active) |
| `POST` | `/api/v1/todos/bible-plans/` | `BibleReadingPlanViewSet.create` | `todos/urls.py:6` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/bible-plans/<int:pk>/` | `BibleReadingPlanViewSet.retrieve` | `todos/urls.py:6` | JWT Cookie / Header | `IsAuthenticated` (Staff/Active) |
| `PUT` | `/api/v1/todos/bible-plans/<int:pk>/` | `BibleReadingPlanViewSet.update` | `todos/urls.py:6` | JWT Cookie / Header | `IsAdminUser` |
| `PATCH` | `/api/v1/todos/bible-plans/<int:pk>/` | `BibleReadingPlanViewSet.partial_update`| `todos/urls.py:6` | JWT Cookie / Header | `IsAdminUser` |
| `DELETE` | `/api/v1/todos/bible-plans/<int:pk>/` | `BibleReadingPlanViewSet.destroy` | `todos/urls.py:6` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/bible-plans/<int:pk>/toggle_active/` | `BibleReadingPlanViewSet.toggle_active` | `todos/views.py:587` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/bible-plans/<int:pk>/set_default/` | `BibleReadingPlanViewSet.set_default` | `todos/views.py:599` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/bible-plans/<int:pk>/schedules/` | `BibleReadingPlanViewSet.schedules` | `todos/views.py:614` | JWT Cookie / Header | `IsAuthenticated` (Staff/Active) |
| `GET` | `/api/v1/todos/schedules/` | `schedule_list` | `todos/urls.py:15` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/schedules/<int:pk>/` | `schedule_detail` | `todos/urls.py:16` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/schedules/month/` | `get_schedules_for_month` | `todos/urls.py:17` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/schedules/today/` | `get_today_schedules` | `todos/urls.py:18` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/todos/schedules/upload-excel/` | `upload_schedules_excel` | `todos/urls.py:19` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/plans/` | `get_available_plans` | `todos/urls.py:25` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/plans/user/` | `get_user_plans` | `todos/urls.py:26` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/plan/` | `plan_subscription_list` | `todos/urls.py:28` | 없음 (기본값) | `AllowAny` (비로그인 대응) |
| `POST` | `/api/v1/todos/plan/` | `plan_subscription_list` | `todos/urls.py:28` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/plan/<int:pk>/` | `plan_subscription_detail` | `todos/urls.py:29` | JWT Cookie / Header | `IsAuthenticated` |
| `PUT` | `/api/v1/todos/plan/<int:pk>/` | `plan_subscription_detail` | `todos/urls.py:29` | JWT Cookie / Header | `IsAuthenticated` |
| `DELETE` | `/api/v1/todos/plan/<int:pk>/` | `plan_subscription_detail` | `todos/urls.py:29` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/plan/<int:pk>/toggle-active/`| `plan_subscription_toggle_active`| `todos/urls.py:30` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/plan/<int:pk>/progress/` | `plan_subscription_progress` | `todos/urls.py:31` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/plan/<int:pk>/unsubscribe/`| `plan_subscription_detail (DELETE)` | `todos/urls.py:32` | JWT Cookie / Header | `IsAuthenticated` |
| **Progress & Reading** | | | | | |
| `POST` | `/api/v1/todos/reading/` | `update_bible_progress` | `todos/urls.py:21` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/reading/update/` | `update_bible_progress` | `todos/urls.py:22` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/reading/history/` | `get_reading_history` | `todos/urls.py:23` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/detail/` | `get_chapter_detail` | `todos/urls.py:34` | 없음 (기본값) | `AllowAny` (비로그인 가능) |
| `GET` | `/api/v1/todos/next-position/` | `get_next_reading_position` | `todos/urls.py:35` | 없음 (기본값) | `AllowAny` (비로그인 가능) |
| `GET` | `/api/v1/todos/bible/reading-position/` | `reading_position_view` | `todos/urls.py:102` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/bible/reading-position/` | `reading_position_view` | `todos/urls.py:102` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/bible/home-stats/` | `get_bible_home_stats` | `todos/urls.py:103` | 없음 (기본값) | `AllowAny` |
| **Bookmarks, Notes, Highlights** (DRF Router) | | | | | |
| `GET/POST`| `/api/v1/todos/bible/bookmarks/` | `BibleBookmarkViewSet.list/create` | `todos/urls.py:7` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/PUT/PATCH/DELETE`| `/api/v1/todos/bible/bookmarks/<int:pk>/` | `BibleBookmarkViewSet.retrieve/etc`| `todos/urls.py:7` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/POST`| `/api/v1/todos/bible/notes/` | `ReflectionNoteViewSet.list/create` | `todos/urls.py:8` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/PUT/PATCH/DELETE`| `/api/v1/todos/bible/notes/<int:pk>/` | `ReflectionNoteViewSet.retrieve/etc`| `todos/urls.py:8` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/POST`| `/api/v1/todos/bible/highlights/` | `BibleHighlightViewSet.list/create` | `todos/urls.py:9` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/PUT/PATCH/DELETE`| `/api/v1/todos/bible/highlights/<int:pk>/`| `BibleHighlightViewSet.retrieve/etc`| `todos/urls.py:9` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/POST`| `/api/v1/todos/bible/personal-records/` | `PersonalReadingRecordViewSet.list/create`| `todos/urls.py:10` | JWT Cookie / Header | `IsAuthenticated` |
| `GET/PUT/PATCH/DELETE`| `/api/v1/todos/bible/personal-records/<int:pk>/`| `PersonalReadingRecordViewSet.retrieve/etc`| `todos/urls.py:10` | JWT Cookie / Header | `IsAuthenticated` |
| **Media (Hasena & Video Intro)** | | | | | |
| `GET` | `/api/v1/todos/video/intro/` | `video_intro_list` | `todos/urls.py:38` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/todos/video/intro/` | `video_intro_list` | `todos/urls.py:38` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/video/intro/<int:pk>/` | `video_intro_detail` | `todos/urls.py:39` | 없음 (기본값) | `AllowAny` |
| `PUT/DELETE`| `/api/v1/todos/video/intro/<int:pk>/`| `video_intro_detail` | `todos/urls.py:39` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/video/intro/upload/` | `upload_video_intros` | `todos/urls.py:40` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/video/intro/progress/` | `update_video_intro_progress`| `todos/urls.py:41` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/user/video/intro/` | `get_user_video_intros` | `todos/urls.py:42` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/hasena/` | `hasena_record_list` | `todos/urls.py:45` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/todos/hasena/` | `hasena_record_list` | `todos/urls.py:45` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/hasena/<int:pk>/` | `hasena_record_detail` | `todos/urls.py:46` | 없음 (기본값) | `AllowAny` |
| `PUT/DELETE`| `/api/v1/todos/hasena/<int:pk>/`| `hasena_record_detail` | `todos/urls.py:46` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/hasena/update/` | `hasena_record_update` | `todos/urls.py:47` | JWT Cookie / Header | `IsAdminUser` |
| `GET` | `/api/v1/todos/hasena/status/` | `get_user_hasena_status` | `todos/urls.py:48` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/hasena/summary/` | `get_hasena_summary` | `todos/urls.py:49` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/hasena/stats/` | `get_hasena_stats` | `todos/urls.py:50` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/hasena/summaries/` | `list_hasena_summaries` | `todos/urls.py:51` | JWT Cookie / Header | `IsAdminUser` |
| `POST` | `/api/v1/todos/hasena/summaries/regenerate/`| `regenerate_hasena_summary`| `todos/urls.py:52` | JWT Cookie / Header | `IsAdminUser` |
| `PUT` | `/api/v1/todos/hasena/summaries/<str:video_id>/`| `update_hasena_summary` | `todos/urls.py:53` | JWT Cookie / Header | `IsAdminUser` |
| **Statistics** | | | | | |
| `GET` | `/api/v1/todos/stats/users/` | `get_total_users` | `todos/urls.py:56` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/stats/plan/` | `get_plan_stats` | `todos/urls.py:57` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/stats/progress/` | `get_progress_stats` | `todos/urls.py:58` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/stats/visitors/` | `get_visitor_stats` | `todos/urls.py:59` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/todos/stats/visitors/increment/`| `increment_visitor_count` | `todos/urls.py:60` | 없음 (기본값) | `AllowAny` |
| **Scoreboard / Leaderboard** | | | | | |
| `GET` | `/api/v1/todos/scoreboard/` | `get_scoreboard` | `todos/urls.py:63` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/scoreboard/friends/` | `get_friends_scoreboard` | `todos/urls.py:64` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/scoreboard/group/<int:group_id>/`| `get_group_scoreboard` | `todos/urls.py:65` | 없음 (기본값) | `AllowAny` (비공개 검증) |
| `GET` | `/api/v1/todos/scoreboard/my-ranking/`| `get_my_ranking` | `todos/urls.py:66` | JWT Cookie / Header | `IsAuthenticated` |
| **Groups** | | | | | |
| `GET` | `/api/v1/todos/groups/` | `get_groups` | `todos/urls.py:69` | 없음 (기본값) | `AllowAny` |
| `POST` | `/api/v1/todos/groups/create/` | `create_group` | `todos/urls.py:70` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/groups/<int:group_id>/`| `get_group_detail` | `todos/urls.py:71` | 없음 (기본값) | `AllowAny` (비공개 검증) |
| `POST` | `/api/v1/todos/groups/<int:group_id>/join/`| `join_group` | `todos/urls.py:72` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/groups/<int:group_id>/leave/`| `leave_group` | `todos/urls.py:73` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/groups/<int:group_id>/members/`| `get_group_members` | `todos/urls.py:74` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/groups/<int:group_id>/member-progress/`| `get_group_member_progress`| `todos/urls.py:75` | 없음 (기본값) | `AllowAny` (비공개 검증) |
| `POST` | `/api/v1/todos/groups/<int:group_id>/invite/`| `invite_to_group` | `todos/urls.py:76` | JWT Cookie / Header | `IsAuthenticated` (Admin 전용) |
| `PATCH` | `/api/v1/todos/groups/<int:group_id>/visibility/`| `update_group_visibility`| `todos/urls.py:77` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/users/<int:user_id>/groups/`| `get_user_public_groups` | `todos/todos/urls.py:78` | 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/todos/invitations/` | `get_my_invitations` | `todos/urls.py:79` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/invitations/<int:invitation_id>/respond/`| `respond_to_invitation` | `todos/urls.py:80` | JWT Cookie / Header | `IsAuthenticated` |
| **Calendar (Multi-plan)** | | | | | |
| `GET` | `/api/v1/todos/calendar/settings/` | `get_calendar_settings` | `todos/urls.py:83` | JWT Cookie / Header | `IsAuthenticated` |
| `PATCH` | `/api/v1/todos/calendar/settings/<int:pk>/`| `update_calendar_setting` | `todos/urls.py:84` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/calendar/settings/reorder/`| `reorder_calendar_settings`| `todos/urls.py:85` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/calendar/month/` | `get_calendar_month_data` | `todos/urls.py:86` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/calendar/last-incomplete/`| `get_last_incomplete_positions`| `todos/urls.py:87` | JWT Cookie / Header | `IsAuthenticated` |
| **Catchup (따라잡기)** | | | | | |
| `GET` | `/api/v1/todos/subscriptions/<int:subscription_id>/catchup-status/`| `catchup_status` | `todos/urls.py:90` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/subscriptions/<int:subscription_id>/catchup/preview/`| `catchup_preview` | `todos/urls.py:91` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/subscriptions/<int:subscription_id>/catchup/`| `catchup_create` | `todos/urls.py:92` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/catchup-sessions/active/`| `my_active_catchup_sessions`| `todos/urls.py:93` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/catchup-sessions/<int:session_id>/`| `catchup_session_detail` | `todos/urls.py:94` | JWT Cookie / Header | `IsAuthenticated` |
| `PATCH` | `/api/v1/todos/catchup-sessions/<int:session_id>/update/`| `catchup_session_update` | `todos/urls.py:95` | JWT Cookie / Header | `IsAuthenticated` |
| `GET` | `/api/v1/todos/catchup-sessions/<int:session_id>/schedules/`| `catchup_session_schedules`| `todos/urls.py:96` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/catchup-sessions/<int:session_id>/complete/`| `catchup_session_complete`| `todos/urls.py:97` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/catchup-sessions/<int:session_id>/abandon/`| `catchup_session_abandon` | `todos/urls.py:98` | JWT Cookie / Header | `IsAuthenticated` |
| `POST` | `/api/v1/todos/catchup-schedules/<int:schedule_id>/toggle/`| `catchup_schedule_toggle`| `todos/urls.py:99` | JWT Cookie / Header | `IsAuthenticated` |
| **Bible Text Cache & Parser** | | | | | |
| `GET` | `/api/v1/bible-cache/versions/`| `get_supported_versions` | `bible_cache/urls.py:6`| 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/bible-cache/<str:version>/<str:book>/<int:chapter>/`| `get_bible_content` | `bible_cache/urls.py:9`| 없음 (기본값) | `AllowAny` |
| `GET` | `/api/v1/bible-cache/<str:version>/<str:book>/<int:chapter>/status/`| `get_cache_status` | `bible_cache/urls.py:16`| 없음 (기본값) | `AllowAny` |

---

## 섹션 B: 뷰 함수/클래스 카탈로그

| 뷰 | 파일:라인 | HTTP 메서드 | 동작 (1줄 요약) | 사용 시리얼라이저 | 사용 모델 (Read/Write) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Accounts App Views** | | | | | |
| `register` | `accounts/views.py:53` | `POST` | 신규 사용자 회원가입 처리 및 기본 플랜 자동 구독 설정 | `RegisterSerializer` / `UserSerializer` | `User` (W), `PlanSubscription` (W) |
| `get_user` | `accounts/views.py:76` | `GET` | 현재 로그인된 사용자의 상세 프로필 정보 조회 | `UserSerializer` | `User` (R) |
| `CustomTokenObtainPairView` | `accounts/views.py:80` | `POST` | 로그인 토큰 발급 (Custom JWT Payload 추가) | `CustomTokenObtainPairSerializer` | `User` (R) |
| `social_login` | `accounts/views.py:86` | `POST` | 카카오 소셜 로그인 처리 (인증 코드/액세스 토큰 이용, 회원가입 필요 시 토큰 제공) | `SocialLoginSerializer` | `User` (R) |
| `check_username` | `accounts/views.py:333` | `POST` | 아이디(username) 중복 확인 | 없음 | `User` (R) |
| `check_nickname` | `accounts/views.py:338` | `POST` | 닉네임 중복 확인 | 없음 | `User` (R) |
| `complete_kakao_signup` | `accounts/views.py:348` | `POST` | 카카오 회원가입 완료 처리 및 기본 플랜 구독 생성 | 없음 | `User` (W), `PlanSubscription` (W) |
| `email_register` | `accounts/views.py:419` | `POST` | 이메일/비밀번호 회원가입 처리 및 기본 플랜 구독 생성 | `EmailRegisterSerializer` | `User` (W), `PlanSubscription` (W) |
| `email_login` | `accounts/views.py:472` | `POST` | 이메일/비밀번호 로그인 처리 및 쿠키 설정 | 없음 | `User` (R) |
| `social_login_v2` | `accounts/views.py:509` | `POST` | 통합 소셜 로그인 v2 (카카오/구글/애플 지원 및 소셜 마이그레이션, 자동 회원가입 지원) | `SocialLoginSerializer` | `User` (R/W), `SocialAccount` (R/W) |
| `complete_social_signup`| `accounts/views.py:727` | `POST` | 통합 소셜 회원가입 완료 처리 | 없음 | `User` (W), `SocialAccount` (W) |
| `get_linked_accounts` | `accounts/views.py:821` | `GET` | 현재 사용자의 연결된 소셜 계정 목록 조회 | `LinkedAccountsSerializer` | `SocialAccount` (R), `User` (R) |
| `link_social_account` | `accounts/views.py:852` | `POST` | 소셜 계정 연동 추가 (이미 다른 계정에 연동된 경우 병합 제안 데이터 반환) | 없음 | `SocialAccount` (R/W) |
| `unlink_social_account` | `accounts/views.py:953` | `POST` | 소셜 계정 연동 해제 (비밀번호나 대체 로그인 수단 존재할 때만 허용) | 없음 | `SocialAccount` (W) |
| `set_password` | `accounts/views.py:982` | `POST` | 이메일 로그인용 비밀번호 설정 및 변경 | `SetPasswordSerializer` | `User` (W) |
| `logout_all_devices` | `accounts/views.py:1009` | `POST` | 모든 기기 로그아웃 (token_version 증가를 통한 토큰 일괄 무효화) | 없음 | `User` (W) |
| `merge_accounts` | `accounts/views.py:1024` | `POST` | 계정 병합 처리 (소셜 연동 이전 및 비유지 계정 30일 후 삭제 대기 설정) | 없음 | `User` (W), `SocialAccount` (W) |
| `delete_account` | `accounts/views.py:74 (legacy)` | `POST` | 계정 탈퇴 (즉시 삭제 또는 대기 처리) | 없음 | `User` (W) |
| `send_verification_email_view`| `accounts/views.py:1210`| `POST` | 이메일 인증용 링크 메일 발송 | 없음 | `EmailVerificationToken` (W), `User` (R) |
| `verify_email` | `accounts/views.py:1237` | `POST` | 이메일 인증 토큰 검증 및 완료 처리 | `UserSerializer` | `EmailVerificationToken` (W), `User` (W) |
| `request_password_reset`| `accounts/views.py:86 (legacy)`| `POST` | 비밀번호 재설정 이메일 발송 | 없음 | `PasswordResetToken` (W) |
| `verify_reset_token` | `accounts/views.py:87 (legacy)`| `POST` | 비밀번호 재설정 토큰 유효성 확인 | 없음 | `PasswordResetToken` (R) |
| `reset_password` | `accounts/views.py:88 (legacy)`| `POST` | 비밀번호 재설정 완료 처리 | 없음 | `PasswordResetToken` (W), `User` (W) |
| `session_bridge_issue` | `accounts/views.py:93 (legacy)`| `POST` | Native ↔ WebView 인증 동기화용 임시 서명 세션 토큰 발행 | 없음 | `User` (R) |
| `session_bridge_consume`| `accounts/views.py:94 (legacy)`| `POST` | 임시 서명 세션 토큰을 검증하고 JWT 쿠키 발급 및 로그인 처리 | `UserSerializer` | `User` (R) |
| `get_user_profile` | `accounts/profile_views.py:28`| `GET` | 사용자 프로필 정보 조회 (공개 범위 검증) | `UserProfileSerializer` | `UserProfile` (R) |
| `update_user_profile` | `accounts/profile_views.py:60`| `PUT` | 사용자 프로필 정보 (소개글, 공개 설정) 수정 | `UserProfileSerializer` | `UserProfile` (W) |
| `get_user_calendar` | `accounts/profile_views.py:82`| `GET` | 사용자 통독 달력 데이터 조회 (N+1 쿼리 최적화 완료) | 없음 | `PlanSubscription` (R), `DailyBibleSchedule` (R), `UserBibleProgress` (R) |
| `get_user_achievements` | `accounts/profile_views.py:395`| `GET` | 사용자가 획득/미획득한 모든 통독 업적 정보 조회 | 없음 | `UserAchievement` (R) |
| `follow_user` | `accounts/profile_views.py:189`| `POST` | 특정 사용자 팔로우 | `FollowSerializer` | `Follow` (W), `User` (R) |
| `unfollow_user` | `accounts/profile_views.py:230`| `DELETE`| 특정 사용자 언팔로우 | 없음 | `Follow` (W) |
| `get_followers` | `accounts/profile_views.py:256`| `GET` | 특정 사용자의 팔로워 목록 조회 | `UserSearchSerializer` | `Follow` (R), `User` (R) |
| `get_following` | `accounts/profile_views.py:294`| `GET` | 특정 사용자가 팔로잉하는 목록 조회 | `UserSearchSerializer` | `Follow` (R), `User` (R) |
| `get_friends` | `accounts/profile_views.py:332`| `GET` | 상호 팔로우 중인 친구 목록 조회 | `UserSearchSerializer` | `Follow` (R), `User` (R) |
| `search_users` | `accounts/profile_views.py:359`| `GET` | 닉네임/아이디 기반 사용자 검색 | `UserSearchSerializer` | `User` (R) |
| `get_reading_settings` | `accounts/profile_views.py:442`| `GET` | 뷰어 읽기 설정 (테마, 폰트, 성경 본문 형식 등) 조회 | 없음 | `UserReadingSettings` (R) |
| `update_reading_settings`| `accounts/profile_views.py:471`| `PATCH`| 뷰어 읽기 설정 업데이트 | 없음 | `UserReadingSettings` (W) |
| **Todos App Views** | | | | | |
| `update_bible_progress` | `todos/views.py:85` | `POST` | 성경 진도 업데이트 API | `UserBibleProgressSerializer` | `UserBibleProgress` (W), `PlanSubscription` (R) |
| `get_reading_history` | `todos/views.py:215` | `GET` | 특정 플랜의 성경 통독 월별/전체 읽기 완료 기록 조회 | `UserBibleProgressSerializer` | `UserBibleProgress` (R) |
| `get_schedules_for_month`| `todos/views.py:258` | `GET` | 특정 월에 배정된 통독 일정 및 완료 여부 조회 (비로그인 호환) | `DailyBibleScheduleSerializer` | `DailyBibleSchedule` (R), `UserBibleProgress` (R) |
| `schedule_list` | `todos/views.py:15 (urls)` | `GET` | 모든 성경 통독 일정 목록 조회 (Staff 전용) | `DailyBibleScheduleSerializer` | `DailyBibleSchedule` (R) |
| `schedule_detail` | `todos/views.py:16 (urls)` | `GET` | 특정 성경 통독 일정 상세 조회 (Staff 전용) | `DailyBibleScheduleSerializer` | `DailyBibleSchedule` (R) |
| `get_today_schedules` | `todos/views.py:875` | `GET` | 오늘 날짜의 성경 통독 배정 일정 및 완료 여부 반환 | 없음 | `DailyBibleSchedule` (R), `UserBibleProgress` (R) |
| `upload_schedules_excel`| `todos/views.py:19 (urls)` | `POST` | 엑셀 파일을 파싱하여 플랜 스케줄을 대량 업로드/대체 (Staff) | `DailyBibleScheduleSerializer` | `DailyBibleSchedule` (W), `BibleReadingPlan` (R) |
| `get_available_plans` | `todos/views.py:1016` | `GET` | 모든 활성화된 공개 읽기 플랜 목록 조회 | `BibleReadingPlanSerializer` | `BibleReadingPlan` (R) |
| `get_user_plans` | `todos/views.py:986` | `GET` | 사용자가 구독 중인 모든 플랜 및 추가 구독 가능한 플랜 목록 조회 | `PlanSubscriptionSerializer` / `BibleReadingPlanSerializer` | `PlanSubscription` (R), `BibleReadingPlan` (R) |
| `plan_subscription_list`| `todos/views.py:624` | `GET/POST`| 구독 중인 플랜 조회 및 신규 플랜 구독 신청 (비로그인은 공개 플랜 목록 반환) | `PlanSubscriptionSerializer` | `PlanSubscription` (R/W), `BibleReadingPlan` (R) |
| `plan_subscription_detail`| `todos/views.py:689`| `GET/PUT/DELETE` | 플랜 구독 상세 조회, 구독일 변경 및 구독 영구 취소 | `PlanSubscriptionSerializer` | `PlanSubscription` (R/W) |
| `plan_subscription_toggle_active`| `todos/views.py:722`| `POST` | 플랜 구독 활성화/비활성화 상태 토글 (일시 정지 기능) | 없음 | `PlanSubscription` (W) |
| `plan_subscription_progress`| `todos/views.py:743`| `GET` | 특정 플랜 구독에 쌓인 완료된 진도 목록 조회 | `UserBibleProgressSerializer` | `UserBibleProgress` (R) |
| `get_chapter_detail` | `todos/views.py:756` | `GET` | 특정 성경 장(Chapter)에 배정된 일정 그룹 및 사용자의 완료 유무 조회 | 없음 | `DailyBibleSchedule` (R), `UserBibleProgress` (R), `BibleReadingPlan` (R) |
| `get_next_reading_position`| `todos/views.py:1033`| `GET` | 사용자가 읽어야 할 다음 진도 위치 정보 조회 (미완료 첫 일정 타겟팅) | 없음 | `DailyBibleSchedule` (R), `UserBibleProgress` (R), `PlanSubscription` (R) |
| `reading_position_view` | `todos/views.py:102 (urls)`| `GET/POST`| 마지막 성경 뷰어 읽기 위치(성경, 장, 절, 스크롤 위치) 조회 및 저장 | `UserReadingPositionSerializer` | `UserReadingPosition` (R/W) |
| `get_bible_home_stats` | `todos/views.py:103 (urls)`| `GET` | 성경 홈 화면에 표시할 통합 대시보드 통계 데이터 반환 | 없음 | `PlanSubscription` (R), `DailyBibleSchedule` (R), `UserBibleProgress` (R) |
| `BibleReadingPlanViewSet`| `todos/views.py:563` | `ViewSet` | 성경 읽기 플랜 관리 뷰셋 (기본 플랜 설정, 활성 토글, 스케줄 연동 포함) | `BibleReadingPlanSerializer` | `BibleReadingPlan` (R/W) |
| `video_intro_list` | `todos/views.py:1243` | `GET/POST`| 플랜/성경책별 영상 개론(유튜브 링크) 목록 조회 및 신규 생성 | `VideoBibleIntroSerializer` | `VideoBibleIntro` (R/W) |
| `video_intro_detail` | `todos/views.py:1290` | `GET/PUT/DELETE` | 특정 영상 개론 조회, 수정, 삭제 (Staff) | `VideoBibleIntroSerializer` | `VideoBibleIntro` (R/W) |
| `upload_video_intros` | `todos/views.py:40 (urls)`| `POST` | 성경 개론 영상 대량 업로드 기능 (Excel/JSON) | 없음 | `VideoBibleIntro` (W) |
| `update_video_intro_progress`| `todos/views.py:41 (urls)`| `POST` | 사용자가 해당 개론 영상을 시청 완료했는지 진행 기록 업데이트 | 없음 | `UserVideoIntroProgress` (W) |
| `get_user_video_intros` | `todos/views.py:42 (urls)`| `GET` | 사용자가 시청해야 하거나 완료한 성경 개론 영상 정보 목록 조회 | `VideoBibleIntroSerializer` | `VideoBibleIntro` (R), `UserVideoIntroProgress` (R) |
| `hasena_record_list` | `todos/views.py:45 (urls)`| `GET/POST`| 하세나(하루 세장 나눔)/하시조 영상 목록 조회 및 추가 | 없음 | `HasenaRecord` (R/W) |
| `hasena_record_detail` | `todos/views.py:46 (urls)`| `GET/PUT/DELETE` | 개별 하세나 영상 레코드 상세 조회 및 관리 | 없음 | `HasenaRecord` (R/W) |
| `hasena_record_update` | `todos/views.py:47 (urls)`| `POST` | 유튜브 API 동기화 및 신규 하세나 레코드 생성/업데이트 | 없음 | `HasenaRecord` (W) |
| `get_user_hasena_status`| `todos/views.py:48 (urls)`| `GET` | 사용자의 최근 하세나 영상 시청 상태 및 묵상 완료 통계 | 없음 | `HasenaRecord` (R) |
| `get_hasena_summary` | `todos/views.py:49 (urls)`| `GET` | 특정 하세나 영상의 본문 내용 요약본 조회 | 없음 | `HasenaRecord` (R) |
| `get_hasena_stats` | `todos/views.py:50 (urls)`| `GET` | 전체 하세나 참여자 및 시청 누적 통계 조회 | 없음 | `HasenaRecord` (R) |
| `get_scoreboard` | `todos/scoreboard_views.py:156`| `GET` | 전역 명예의 전당 리더보드 랭킹 조회 (기간 필터링, N+1 쿼리 캐싱 최적화) | 없음 | `User` (R), `UserProfile` (R), `UserBibleProgress` (R) |
| `get_friends_scoreboard`| `todos/scoreboard_views.py:242`| `GET` | 내가 팔로우하는 친구들의 통독 랭킹 리더보드 조회 (상호/일방 팔로우 모드) | 없음 | `User` (R), `Follow` (R), `UserBibleProgress` (R) |
| `get_group_scoreboard` | `todos/scoreboard_views.py:326`| `GET` | 소그룹/공동체 내의 멤버들 간 통독 진도 리더보드 조회 | 없음 | `ReadingGroup` (R), `GroupMembership` (R), `User` (R) |
| `get_my_ranking` | `todos/scoreboard_views.py:484`| `GET` | 내 통독 진도 백분위수 및 랭킹 조회 (나보다 많이 읽은 사용자 계산 최적화)| 없음 | `UserProfile` (R), `UserBibleProgress` (R) |
| `get_groups` | `todos/group_views.py:128`| `GET` | 소그룹 목록 조회 (검색 및 내 소그룹 필터 제공) | 없음 | `ReadingGroup` (R) |
| `create_group` | `todos/group_views.py:64` | `POST` | 신규 성경 통독 소그룹 생성 및 본인을 관리자로 자동 지정 | 없음 | `ReadingGroup` (W), `GroupMembership` (W) |
| `get_group_detail` | `todos/group_views.py:182`| `GET` | 특정 소그룹 정보 상세 조회 | 없음 | `ReadingGroup` (R) |
| `join_group` | `todos/group_views.py:221`| `POST` | 소그룹 가입 처리 (비공개 그룹은 초대권 확인 후 가입) | 없음 | `GroupMembership` (W), `GroupInvitation` (W) |
| `leave_group` | `todos/group_views.py:296`| `POST` | 소그룹 탈퇴 처리 (그룹 생성자는 탈퇴 불가능) | 없음 | `GroupMembership` (W) |
| `get_group_members` | `todos/group_views.py:338`| `GET` | 특정 소그룹의 모든 활성 멤버 목록 조회 | `UserSearchSerializer` | `GroupMembership` (R), `User` (R) |
| `get_group_member_progress`| `todos/group_views.py:639`| `GET` | 그룹 내 모든 멤버들의 월별 캘린더 통독 진행도 일괄 조회 (Grid View용)| 없음 | `DailyBibleSchedule` (R), `GroupMembership` (R), `UserBibleProgress` (R) |
| `invite_to_group` | `todos/group_views.py:392`| `POST` | 소그룹에 새로운 유저를 초대 (소그룹 관리자 전용) | 없음 | `GroupInvitation` (W) |
| `get_my_invitations` | `todos/group_views.py:463`| `GET` | 나에게 도착한 소그룹 대기 중인 초대장 목록 조회 | `UserSearchSerializer` | `GroupInvitation` (R) |
| `respond_to_invitation` | `todos/group_views.py:495`| `POST` | 수신한 소그룹 초대를 수락 또는 거절 | 없음 | `GroupInvitation` (W), `GroupMembership` (W) |
| `get_user_public_groups`| `todos/group_views.py:557`| `GET` | 특정 사용자의 프로필에 표시된 그룹 조회 | 없음 | `ReadingGroup` (R), `GroupMembership` (R) |
| `update_group_visibility`| `todos/group_views.py:609`| `PATCH`| 소그룹 멤버십의 내 프로필 노출 여부 변경 설정 | 없음 | `GroupMembership` (W) |
| `get_calendar_settings` | `todos/calendar_views.py:26`| `GET` | 사용자의 멀티플랜 캘린더 표시 설정(색상, 노출 여부 등) 조회 | `UserPlanDisplaySettingsSerializer`| `UserPlanDisplaySettings` (R) |
| `update_calendar_setting`| `todos/calendar_views.py:46`| `PATCH`| 개별 캘린더 표시 색상 및 가시성 설정 수정 | `UserPlanDisplaySettingsSerializer`| `UserPlanDisplaySettings` (W) |
| `reorder_calendar_settings`| `todos/calendar_views.py:76`| `POST` | 멀티플랜의 캘린더 렌더링 표시 우선순위 순서(Order) 일괄 재정렬 | `UserPlanDisplaySettingsSerializer`| `UserPlanDisplaySettings` (W) |
| `get_calendar_month_data`| `todos/calendar_views.py:119`| `GET` | 멀티플랜 통합 월별 캘린더 데이터 (날짜별 스케줄 및 완료 여부) 조회 | `UserPlanDisplaySettingsSerializer`| `DailyBibleSchedule` (R), `UserBibleProgress` (R) |
| `get_last_incomplete_positions`| `todos/calendar_views.py:222`| `GET` | 구독 중인 각 플랜별 마지막으로 읽지 않은 미완료 통독 위치 목록 반환 | 없음 | `PlanSubscription` (R), `DailyBibleSchedule` (R) |
| `catchup_status` | `todos/catchup_views.py:29`| `GET` | 구독 플랜의 밀린 일정 개수, 밀린 장(Chapter) 수, 세션 현황 등 조회 | `CatchupStatusSerializer` | `PlanSubscription` (R), `DailyBibleSchedule` (R) |
| `catchup_preview` | `todos/catchup_views.py:82`| `POST` | 밀린 일정을 특정 전략(분배식, 순차식)과 목표일에 맞춤 분배 시뮬레이션 | `CatchupPreviewRequestSerializer` | `DailyBibleSchedule` (R) |
| `catchup_create` | `todos/catchup_views.py:184`| `POST` | 따라잡기(Catchup) 세션을 생성하고 일자별 스케줄을 배정 | `CatchupSessionCreateSerializer` | `CatchupSession` (W), `CatchupSchedule` (W) |
| `catchup_session_detail`| `todos/catchup_views.py:258`| `GET` | 생성된 따라잡기 세션의 현재 진도 및 상세 설정 조회 | `CatchupSessionSerializer` | `CatchupSession` (R) |
| `catchup_session_update`| `todos/catchup_views.py:273`| `PATCH`| 진행 중인 따라잡기 세션 정보 수정 및 스케줄 재배정(Recalculate) | `CatchupSessionSerializer` | `CatchupSession` (W), `CatchupSchedule` (W) |
| `catchup_session_schedules`| `todos/catchup_views.py:332`| `GET` | 따라잡기 세션에 할당된 일자별 스케줄 목록 조회 | `CatchupScheduleSerializer` | `CatchupSchedule` (R) |
| `catchup_schedule_toggle`| `todos/catchup_views.py:372`| `POST` | 따라잡기 전용 개별 스케줄 읽기 완료 여부를 토글 | 없음 | `CatchupSchedule` (W), `UserBibleProgress` (W) |
| `catchup_session_complete`| `todos/catchup_views.py:404`| `POST` | 따라잡기 세션을 수동 완료 처리하고 축하 피드백 데이터 생성 반환 | `CatchupCompleteResponseSerializer` | `CatchupSession` (W) |
| `catchup_session_abandon`| `todos/catchup_views.py:440`| `POST` | 활성화된 따라잡기 세션을 중도 포기 및 비활성(abandoned) 처리 | 없음 | `CatchupSession` (W) |
| `my_active_catchup_sessions`| `todos/catchup_views.py:460`| `GET` | 현재 진행 중인 내 모든 따라잡기 세션 목록 조회 | `CatchupSessionSerializer` | `CatchupSession` (R) |
| **Bible Text Cache Views** | | | | | |
| `get_supported_versions`| `bible_cache/views.py:145`| `GET` | 시스템이 지원하는 성경 번역본(KNT, GAE, ASV 등) 코드 및 한글명 반환 | 없음 | 없음 |
| `get_bible_content` | `bible_cache/views.py:19`| `GET` | 성경 본문 데이터 조회 (캐시 조회 우선, 미존재 시 크롤링하여 캐시 저장) | 없음 | `BibleContentCache` (R/W) |
| `get_cache_status` | `bible_cache/views.py:110`| `GET` | 성경 특정 장의 로컬 데이터베이스 캐시 적중 여부 및 상태 확인 | 없음 | `BibleContentCache` (R) |

---

## 섹션 C: 시리얼라이저

| 시리얼라이저 | 파일:라인 | 모델 | 필드 (주요) | 커스텀 메서드 |
| :--- | :--- | :--- | :--- | :--- |
| `UserSerializer` | `accounts/serializers.py:12` | `User` | `id`, `username`, `nickname`, `email`, `profile_image`, `is_staff`, `email_verified`, `has_usable_password_flag` | `get_is_staff` |
| `PublicUserSerializer` | `accounts/serializers.py:25` | `User` | `id`, `username`, `nickname`, `profile_image` | 없음 |
| `RegisterSerializer` | `accounts/serializers.py:30` | `User` | `username`, `password`, `nickname` | `validate_username`, `validate_nickname`, `create` |
| `SocialLoginSerializer` | `accounts/serializers.py:55` | 없음 | `provider`, `code`, `access_token` | 없음 |
| `CustomTokenObtainPairSerializer` | `accounts/serializers.py:60` | 없음 | SimpleJWT 기본 필드 + `nickname`, `is_social`, `token_version` | `get_token`, `validate` |
| `UserProfileSerializer` | `accounts/serializers.py:75` | `UserProfile` | `id`, `user`, `bio`, `total_completed_days`, `current_streak`, `longest_streak`, `joined_date`, `is_public`, `followers_count`, `following_count`, `is_following`, `is_mutual_follow` | `get_user`, `get_followers_count`, `get_following_count`, `get_is_following`, `get_is_mutual_follow` |
| `FollowSerializer` | `accounts/serializers.py:131` | `Follow` | `id`, `follower`, `following`, `created_at` | 없음 |
| `UserAchievementSerializer` | `accounts/serializers.py:142` | `UserAchievement` | `id`, `achievement_type`, `achievement_display`, `achieved_at`, `milestone_value`, `details` | 없음 |
| `UserCalendarDataSerializer` | `accounts/serializers.py:155` | 없음 | `date`, `is_completed`, `book`, `chapters` | 없음 |
| `UserSearchSerializer` | `accounts/serializers.py:163` | `User` | `id`, `username`, `nickname`, `profile_image`, `is_following`, `total_completed_days` | `get_is_following`, `get_total_completed_days` |
| `EmailRegisterSerializer` | `accounts/serializers.py:198` | 없음 | `email`, `password`, `password_confirm`, `nickname` | `validate_email`, `validate_nickname`, `validate_password`, `validate` |
| `SetPasswordSerializer` | `accounts/serializers.py:229` | 없음 | `new_password`, `new_password_confirm`, `current_password` | `validate_new_password`, `validate` |
| `LinkedAccountsSerializer` | `accounts/serializers.py:248` | 없음 | `has_password`, `email`, `linked_accounts` | 없음 |
| `DailyBibleScheduleSerializer` | `todos/serializers.py:15` | `DailyBibleSchedule` | `id`, `plan`, `plan_name`, `date`, `book`, `start_chapter`, `end_chapter`, `audio_link`, `guide_link` | `validate_audio_link`, `validate_guide_link` |
| `UserBibleProgressSerializer` | `todos/serializers.py:101` | `UserBibleProgress` | `id`, `subscription`, `plan_name`, `is_completed`, `completed_at`, `date`, `schedule` | `get_date` |
| `BibleProgressResponse` | `todos/serializers.py:113` | 없음 | `status`, `section` | `get_section` |
| `BibleReadingPlanSerializer` | `todos/serializers.py:129` | `BibleReadingPlan` | `id`, `name`, `description`, `is_default`, `is_active`, `created_by`, `created_by_username`, `subscriber_count` | `get_created_by_username`, `get_subscriber_count` |
| `PlanSubscriptionSerializer` | `todos/serializers.py:153` | `PlanSubscription` | `id`, `plan_id`, `plan_name`, `is_active`, `is_default`, `start_date` | 없음 |
| `VideoBibleIntroSerializer` | `todos/serializers.py:165` | `VideoBibleIntro` | `id`, `plan`, `plan_name`, `book`, `url_link`, `start_date`, `end_date` | 없음 |
| `UserPlanDisplaySettingsSerializer` | `todos/serializers.py:174` | `UserPlanDisplaySettings` | `id`, `subscription_id`, `plan_id`, `plan_name`, `color`, `display_order`, `is_visible`, `is_active` | 없음 |
| `CalendarDayScheduleSerializer` | `todos/serializers.py:190` | 없음 | `plan_id`, `plan_name`, `color`, `book`, `chapters`, `is_completed`, `schedule_id` | 없음 |
| `LastIncompletePositionSerializer` | `todos/serializers.py:201` | 없음 | `plan_id`, `plan_name`, `subscription_id`, `date`, `book`, `chapters` | 없음 |
| `OverdueScheduleSerializer` | `todos/serializers.py:213` | `DailyBibleSchedule` | `id`, `date`, `book`, `start_chapter`, `end_chapter` | 없음 |
| `CatchupSessionSerializer` | `todos/serializers.py:220` | `CatchupSession` | `id`, `name`, `subscription`, `plan_name`, `range_start`, `range_end`, `strategy`, `target_rejoin_date`, `max_daily_readings`, `max_daily_chapters`, `weekend_multiplier`, `status`, `completed_at`, `progress_percentage`, `completed_count`, `total_count`, `remaining_count` | 없음 |
| `CatchupStatusSerializer` | `todos/serializers.py:242` | 없음 | `has_overdue`, `overdue_count`, `overdue_chapters`, `overdue_range`, `overdue_schedules`, `active_catchup_session`, `suggested_settings` | `get_active_catchup_session` |
| `CatchupPreviewRequestSerializer` | `todos/serializers.py:259` | 없음 | `range_start`, `range_end`, `strategy`, `max_daily_readings`, `max_daily_chapters`, `weekend_multiplier`, `target_rejoin_date` | 없음 |
| `CatchupSessionCreateSerializer` | `todos/serializers.py:276` | `CatchupSession` | `name`, `range_start`, `range_end`, `strategy`, `target_rejoin_date`, `max_daily_readings`, `max_daily_chapters`, `weekend_multiplier` | `validate` |
| `CatchupScheduleSerializer` | `todos/serializers.py:295` | `CatchupSchedule` | `id`, `session`, `scheduled_date`, `book`, `start_chapter`, `end_chapter`, `original_date`, `audio_link`, `guide_link`, `is_completed`, `completed_at` | 없음 |
| `CatchupCompleteResponseSerializer` | `todos/serializers.py:315` | 없음 | `success`, `message`, `celebration`, `warning` | 없음 |
| `UserReadingPositionSerializer` | `todos/serializers.py:344` | `UserReadingPosition` | `book`, `chapter`, `verse`, `scroll_position`, `version`, `updated_at` | 없음 |
| `BibleBookmarkSerializer` | `todos/serializers.py:352` | `BibleBookmark` | `id`, `bookmark_type`, `book`, `book_name`, `chapter`, `start_verse`, `end_verse`, `title`, `color`, `memo`, `created_at`, `updated_at` | `get_book_name` |
| `ReflectionNoteSerializer` | `todos/serializers.py:369` | `ReflectionNote` | `id`, `book`, `book_name`, `chapter`, `start_verse`, `end_verse`, `content`, `is_private`, `created_at`, `updated_at` | `get_book_name` |
| `BibleHighlightSerializer` | `todos/serializers.py:386` | `BibleHighlight` | `id`, `book`, `book_name`, `chapter`, `start_verse`, `end_verse`, `color`, `memo`, `created_at`, `updated_at` | `get_book_name` |
| `PersonalReadingRecordSerializer` | `todos/serializers.py:403` | `PersonalReadingRecord` | `id`, `book`, `book_name`, `chapter`, `read_date`, `created_at` | `get_book_name` |

---

## 섹션 D: 인증 흐름 요약

매일일독 서비스의 백엔드 인증은 **Cookie 기반 및 Header 기반 이중 JWT(JSON Web Token) 아키처**를 사용하며, 점진적 마이그레이션 및 네이티브 앱/웹뷰 연동까지 고려하여 정교하게 설계되어 있습니다.

### 1. JWT 발급/갱신 엔드포인트 위치
*   **로그인 및 토큰 발급 (`CookieTokenObtainPairView`)**: `/api/v1/auth/token/` (or `/api/v1/auth/login/`)
    *   사용자가 아이디/비밀번호 혹은 이메일/비밀번호로 인증을 성공하면 `access_token`과 `refresh_token`을 생성합니다.
    *   발급된 토큰은 **HttpOnly Cookie**와 **응답 바디 JSON** 양쪽에 실려 클라이언트로 반환됩니다.
*   **토큰 갱신 (`CookieTokenRefreshView`)**: `/api/v1/auth/token/refresh/` (or `/api/v1/auth/refresh/`)
    *   쿠키 또는 바디에 실려온 `refresh_token`을 검증하여 새로운 `access_token`(및 설정에 따라 갱신된 `refresh_token`)을 발급합니다.
    *   새로 갱신된 토큰 역시 쿠키와 JSON 응답 바디에 모두 동기화됩니다.
*   **쿠키 삭제 및 토큰 폐기 (`cookie_logout`)**: `/api/v1/auth/logout/`
    *   클라이언트 브라우저의 JWT 인증 쿠키(`access_token`, `refresh_token` 쿠키)를 강제 삭제 처리하며, 전달받은 refresh 토큰을 SimpleJWT의 **Blacklist 테이블에 등록**하여 완벽히 폐기합니다.

### 2. OAuth 콜백 핸들러 위치
*   **카카오 로그인 콜백 (`social_login`)**: `/api/v1/auth/social-login/`
    *   프론트엔드로부터 `code`(인가 코드) 또는 Native SDK에서 획득한 `access_token`을 전달받습니다.
    *   백엔드는 해당 코드를 카카오 API 서버와 직접 통신하여 액세스 토큰으로 교환하거나(`get_kakao_user_info`), 전달받은 토큰으로 카카오 사용자 정보 조회 API(`https://kapi.kakao.com/v2/user/me`)를 직접 호출하여 사용자의 고유 ID(`id`) 및 프로필을 확인합니다.
*   **통합 소셜 로그인 v2 콜백 (`social_login_v2`)**: `/api/v1/accounts/social-login/v2/`
    *   **카카오(Kakao)**, **구글(Google)**, **애플(Apple)** 소셜 로그인을 통합 처리하는 핵심 콜백 핸들러입니다.
    *   **구글**: 프론트엔드가 보낸 인가 코드 또는 토큰을 구글 사용자 정보 엔드포인트(`https://www.googleapis.com/oauth2/v3/userinfo`)와 통신하여 검증하고 프로필을 획득합니다.
    *   **애플**: 애플 로그인 시 전달되는 `id_token` (JWT)을 애플의 공개 키 목록(`https://appleid.apple.com/auth/keys`)을 동적으로 획득하여 직접 로컬 디코딩 및 서명 검증(`PyJWKClient` 사용)을 실행합니다. `aud`, `iss` 등의 클레임 검증 후 사용자의 고유 서브젝트 ID(`sub`)를 추출해 연동합니다.
    *   **회원가입 분기**: 기존 연동된 소셜 계정이 없을 경우, 서명 토큰(`signup_token`) 및 Needs Signup 플래그를 담아 반환하여 클라이언트 측에서 닉네임 설정을 마친 뒤 `complete_social_signup`(/api/v1/accounts/complete-social-signup/) 엔드포인트를 호출하여 가입을 매듭짓게 합니다.

### 3. 쿠키 vs 헤더 기반 분기 위치
백엔드는 클라이언트 환경(일반 브라우저 웹, PWA 웹, Native 모바일 앱)에 유연하게 대응하기 위해 **이중 JWT 추출 미들웨어/인증 클래스**를 운용합니다.
*   **토큰 추출 분기 로직 (`accounts/authentication.py`)**:
    *   클라이언트 요청이 도달하면, 백엔드의 `JWTCookieAuthentication` 클래스는 먼저 HTTP 요청 객체의 `COOKIES` 딕셔너리에서 `access_token` 키가 존재하는지 탐색합니다.
    *   브라우저 환경(쿠키 존재)인 경우 쿠키에서 읽어온 토큰을 최우선으로 검증에 사용합니다.
    *   모바일 Native 앱처럼 쿠키를 지원하지 않거나 Native HTTP 클라이언트인 경우, HTTP 요청의 `Authorization: Bearer <token>` 헤더에서 JWT를 파싱하는 DRF SimpleJWT 기본 추출 흐름으로 자동 대체(Fallback)됩니다.
*   **세션 브리지 (Bridge) 인증 동기화**: `/api/v1/accounts/session/issue/` & `/api/v1/accounts/session/consume/`
    *   네이티브 모바일 앱과 그 내부의 웹뷰(WebView) 간 세션 단절 문제를 해결하기 위한 브리지 설계입니다.
    *   앱 측에서 발급받은 JWT 인증 상태를 기반으로 일회성 세션 토큰을 `issue`하고, 웹뷰에서 이를 `consume`하여 웹뷰 내부 브라우저 쿠키에 JWT를 HttpOnly로 주입해 동기화 상태를 완성합니다.
