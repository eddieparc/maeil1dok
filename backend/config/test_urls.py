from django.urls import include, path
from config.health_views import health, readiness

urlpatterns = [
    path('health/', health, name='health'),
    path('ready/', readiness, name='readiness'),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/accounts/', include('accounts.urls')),
    path('api/v1/todos/', include('todos.urls')),
    path('api/v1/bible-cache/', include('bible_cache.urls')),
]
