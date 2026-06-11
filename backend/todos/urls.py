from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views, scoreboard_views, group_views, calendar_views, catchup_views

router = DefaultRouter()
router.register(r'bible-plans', views.BibleReadingPlanViewSet)
router.register(r'bible/bookmarks', views.BibleBookmarkViewSet, basename='bible-bookmark')
router.register(r'bible/notes', views.ReflectionNoteViewSet, basename='reflection-note')
router.register(r'bible/highlights', views.BibleHighlightViewSet, basename='bible-highlight')
router.register(r'bible/personal-records', views.PersonalReadingRecordViewSet, basename='personal-record')

urlpatterns = [
    path('', include(router.urls)),
    
    path('schedules/', views.schedule_list, name='schedule-list'),
    path('schedules/<int:pk>/', views.schedule_detail, name='schedule-detail'),
    path('schedules/month/', views.get_schedules_for_month, name='schedules-month'),
    path('schedules/today/', views.get_today_schedules, name='schedules-today'),
    path('schedules/upload-excel/', views.upload_schedules_excel, name='upload-schedules-excel'),
    
    path('reading/', views.update_bible_progress, name='update_bible_progress'),
    path('reading/update/', views.update_bible_progress, name='update_bible_progress'),
    path('reading/history/', views.get_reading_history, name='progress-history'),

    path('plans/', views.get_available_plans, name='available-plans'),
    path('plans/user/', views.get_user_plans, name='user-plans'),

    path('plan/', views.plan_subscription_list, name='plan-subscription-list'),
    path('plan/<int:pk>/', views.plan_subscription_detail, name='plan-subscription-detail'),
    path('plan/<int:pk>/toggle-active/', views.plan_subscription_toggle_active, name='plan-subscription-toggle-active'),
    path('plan/<int:pk>/progress/', views.plan_subscription_progress, name='plan-subscription-progress'),
    path('plan/<int:pk>/unsubscribe/', views.plan_subscription_unsubscribe, name='plan-subscription-unsubscribe'),
    
    path('detail/', views.get_chapter_detail, name='chapter-detail'),
    path('next-position/', views.get_next_reading_position, name='next-reading-position'),
    
    # 영상 개론 관련 URL
    path('video/intro/', views.video_intro_list, name='video-intro-list'),
    path('video/intro/<int:pk>/', views.video_intro_detail, name='video-intro-detail'),
    path('video/intro/upload/', views.upload_video_intros, name='upload-video-intros'),
    path('video/intro/progress/', views.update_video_intro_progress, name='update-video-intro-progress'),
    path('user/video/intro/', views.get_user_video_intros, name='user-video-intros'),
    
    # 하세나 관련 URL
    path('hasena/', views.hasena_record_list, name='hasena-record-list'),
    path('hasena/<int:pk>/', views.hasena_record_detail, name='hasena-record-detail'),
    path('hasena/update/', views.hasena_record_update, name='hasena-record-update'),
    path('hasena/status/', views.get_user_hasena_status, name='hasena-user-status'),
    path('hasena/summary/', views.get_hasena_summary, name='hasena-summary'),
    path('hasena/summary/cron/', views.generate_hasena_summary_from_cron, name='hasena-summary-cron'),
    path('hasena/stats/', views.get_hasena_stats, name='hasena-stats'),
    path('hasena/summaries/', views.list_hasena_summaries, name='hasena-summaries-list'),
    path('hasena/summaries/regenerate/', views.regenerate_hasena_summary, name='hasena-summary-regenerate'),
    path('hasena/summaries/<str:video_id>/', views.update_hasena_summary, name='hasena-summary-update'),
        
    # 통계 관련 URL
    path('stats/users/', views.get_total_users, name='total-users'),
    path('stats/plan/', views.get_plan_stats, name='plan-stats'),
    path('stats/progress/', views.get_progress_stats, name='progress-stats'),
    path('stats/visitors/', views.get_visitor_stats, name='visitor-stats'),
    path('stats/visitors/increment/', views.increment_visitor_count, name='increment-visitor-count'),
    
    # 스코어보드/리더보드 관련 URL
    path('scoreboard/', scoreboard_views.get_scoreboard, name='scoreboard'),
    path('scoreboard/friends/', scoreboard_views.get_friends_scoreboard, name='friends-scoreboard'),
    path('scoreboard/group/<int:group_id>/', scoreboard_views.get_group_scoreboard, name='group-scoreboard'),
    path('scoreboard/my-ranking/', scoreboard_views.get_my_ranking, name='my-ranking'),
    
    # 그룹 관련 URL
    path('groups/', group_views.get_groups, name='groups-list'),
    path('groups/create/', group_views.create_group, name='create-group'),
    path('groups/<int:group_id>/', group_views.get_group_detail, name='group-detail'),
    path('groups/<int:group_id>/join/', group_views.join_group, name='join-group'),
    path('groups/<int:group_id>/leave/', group_views.leave_group, name='leave-group'),
    path('groups/<int:group_id>/members/', group_views.get_group_members, name='group-members'),
    path('groups/<int:group_id>/member-progress/', group_views.get_group_member_progress, name='group-member-progress'),
    path('groups/<int:group_id>/invite/', group_views.invite_to_group, name='invite-to-group'),
    path('groups/<int:group_id>/visibility/', group_views.update_group_visibility, name='group-visibility'),
    path('users/<int:user_id>/groups/', group_views.get_user_public_groups, name='user-public-groups'),
    path('invitations/', group_views.get_my_invitations, name='my-invitations'),
    path('invitations/<int:invitation_id>/respond/', group_views.respond_to_invitation, name='respond-invitation'),

    # 멀티플랜 캘린더 관련 URL
    path('calendar/settings/', calendar_views.get_calendar_settings, name='calendar-settings'),
    path('calendar/settings/<int:pk>/', calendar_views.update_calendar_setting, name='calendar-setting-detail'),
    path('calendar/settings/reorder/', calendar_views.reorder_calendar_settings, name='calendar-settings-reorder'),
    path('calendar/month/', calendar_views.get_calendar_month_data, name='calendar-month'),
    path('calendar/last-incomplete/', calendar_views.get_last_incomplete_positions, name='calendar-last-incomplete'),

    # 따라잡기(Catchup) 관련 URL
    path('subscriptions/<int:subscription_id>/catchup-status/', catchup_views.catchup_status, name='catchup-status'),
    path('subscriptions/<int:subscription_id>/catchup/preview/', catchup_views.catchup_preview, name='catchup-preview'),
    path('subscriptions/<int:subscription_id>/catchup/', catchup_views.catchup_create, name='catchup-create'),
    path('catchup-sessions/active/', catchup_views.my_active_catchup_sessions, name='catchup-sessions-active'),
    path('catchup-sessions/<int:session_id>/', catchup_views.catchup_session_detail, name='catchup-session-detail'),
    path('catchup-sessions/<int:session_id>/update/', catchup_views.catchup_session_update, name='catchup-session-update'),
    path('catchup-sessions/<int:session_id>/schedules/', catchup_views.catchup_session_schedules, name='catchup-session-schedules'),
    path('catchup-sessions/<int:session_id>/complete/', catchup_views.catchup_session_complete, name='catchup-session-complete'),
    path('catchup-sessions/<int:session_id>/abandon/', catchup_views.catchup_session_abandon, name='catchup-session-abandon'),
    path('catchup-schedules/<int:schedule_id>/toggle/', catchup_views.catchup_schedule_toggle, name='catchup-schedule-toggle'),

    # 성경읽기 기능 관련 URL
    path('bible/reading-position/', views.reading_position_view, name='reading-position'),
    path('bible/home-stats/', views.get_bible_home_stats, name='bible-home-stats'),
] 
