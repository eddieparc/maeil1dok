from django.urls import path
from . import views

urlpatterns = [
    # 지원 번역본 목록
    path('versions/', views.get_supported_versions, name='bible-cache-versions'),

    # Keep search before the dynamic content route so it is not parsed as a version.
    path('search/', views.search_cached_content, name='bible-cache-search'),

    # 성경 본문 조회
    path(
        '<str:version>/<str:book>/<int:chapter>/',
        views.get_bible_content,
        name='bible-cache-content'
    ),

    # 캐시 상태 확인
    path(
        '<str:version>/<str:book>/<int:chapter>/status/',
        views.get_cache_status,
        name='bible-cache-status'
    ),
]
