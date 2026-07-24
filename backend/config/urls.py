"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from config.health_views import health, readiness

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health, name='health'),
    path('ready/', readiness, name='readiness'),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/accounts/', include('accounts.urls')),  # 프로필, 팔로우 등 계정 관련 API
    path('api/v1/todos/', include('todos.urls')),
    path('api/v1/bible-cache/', include('bible_cache.urls')),  # 성경 본문 캐시 API
]
