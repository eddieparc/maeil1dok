from django.urls import include, path
from config.health_views import health, readiness
from accounts.support_views import SupportInquiryView

urlpatterns = [
    path('health/', health, name='health'),
    path('ready/', readiness, name='readiness'),
    path('api/v1/support/inquiries/', SupportInquiryView.as_view(), name='support-inquiry-create'),
    path('api/v1/admin/members/', include('accounts.admin_member_urls')),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/accounts/', include('accounts.urls')),
    path('api/v1/todos/', include('todos.urls')),
    path('api/v1/bible-cache/', include('bible_cache.urls')),
]
