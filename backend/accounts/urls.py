from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views, profile_views, cookie_views
from .views import CustomTokenObtainPairView
from .cookie_views import CookieTokenObtainPairView, CookieTokenRefreshView

urlpatterns = [
    # HttpOnly Cookie 기반 인증 엔드포인트 (권장)
    path('token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', cookie_views.cookie_logout, name='logout'),
    path('csrf/', cookie_views.get_csrf_token, name='csrf_token'),
    path('verify/', cookie_views.verify_auth, name='verify_auth'),

    # 기존 인증 관련 엔드포인트 (하위 호환)
    path('register/', views.register, name='register'),
    path('login/', CookieTokenObtainPairView.as_view(), name='login'),
    path('refresh/', CookieTokenRefreshView.as_view(), name='token_refresh_legacy'),
    path('user/', views.get_user, name='get_user'),
    path('social-login/', views.social_login, name='social_login'),
    path('check-username/', views.check_username, name='check_username'),
    path('check-nickname/', views.check_nickname, name='check_nickname'),
    path('complete-kakao-signup/', views.complete_kakao_signup, name='complete_kakao_signup'),
    
    # 프로필 관련 엔드포인트
    path('profile/<int:user_id>/', profile_views.get_user_profile, name='get_user_profile'),
    path('profile/', profile_views.update_user_profile, name='update_user_profile'),
    path('profile/<int:user_id>/calendar/', profile_views.get_user_calendar, name='get_user_calendar'),
    path('profile/<int:user_id>/achievements/', profile_views.get_user_achievements, name='get_user_achievements'),
    
    # 팔로우 관련 엔드포인트
    path('follow/', profile_views.follow_user, name='follow_user'),
    path('unfollow/<int:user_id>/', profile_views.unfollow_user, name='unfollow_user'),
    path('followers/<int:user_id>/', profile_views.get_followers, name='get_followers'),
    path('following/<int:user_id>/', profile_views.get_following, name='get_following'),
    path('friends/', profile_views.get_friends, name='get_friends'),
    
    # 사용자 검색
    path('search/', profile_views.search_users, name='search_users'),

    # 읽기 설정
    path('reading-settings/', profile_views.get_reading_settings, name='get_reading_settings'),
    path('reading-settings/update/', profile_views.update_reading_settings, name='update_reading_settings'),
    
    # ========================================
    # 이메일/비밀번호 인증 (매일일독 계정)
    # ========================================
    path('email-register/', views.email_register, name='email_register'),
    path('email-login/', views.email_login, name='email_login'),
    
    # ========================================
    # 소셜 로그인 v2 (통합)
    # ========================================
    path('social-login/v2/', views.social_login_v2, name='social_login_v2'),
    path('complete-social-signup/', views.complete_social_signup, name='complete_social_signup'),
    
    # ========================================
    # 계정 연동 관리
    # ========================================
    path('linked-accounts/', views.get_linked_accounts, name='get_linked_accounts'),
    path('account-email/', views.account_email, name='account_email'),
    path('notification-settings/', views.notification_settings, name='notification_settings'),
    path('oauth/link-state/', views.issue_oauth_link_state, name='issue_oauth_link_state'),
    path('link-social/', views.link_social_account, name='link_social_account'),
    path('unlink-social/', views.unlink_social_account, name='unlink_social_account'),
    path('set-password/', views.set_password, name='set_password'),
    path('logout-all/', views.logout_all_devices, name='logout_all_devices'),
    
    # ========================================
    # 계정 병합
    # ========================================
    path('merge-accounts/', views.merge_accounts, name='merge_accounts'),
    
    # ========================================
    # 계정 삭제
    # ========================================
    path('delete-account/', views.delete_account, name='delete_account'),
    
    # ========================================
    # 이메일 인증
    # ========================================
    path('send-verification/', views.send_verification_email_view, name='send_verification_email'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('resend-verification/', views.resend_verification_email, name='resend_verification_email'),
    
    # ========================================
    # 비밀번호 재설정
    # ========================================
    path('request-password-reset/', views.request_password_reset, name='request_password_reset'),
    path('verify-reset-token/', views.verify_reset_token, name='verify_reset_token'),
    path('reset-password/', views.reset_password, name='reset_password'),
    
    # ========================================
    # 세션 브리지 (Native ↔ WebView 인증 동기화)
    # ========================================
    path('session/issue/', views.session_bridge_issue, name='session_bridge_issue'),
    path('session/consume/', views.session_bridge_consume, name='session_bridge_consume'),
]
