from django.urls import path

from accounts.admin_member_views import (
    MemberActionView, MemberActivityView, MemberBulkView, MemberDetailView,
    MemberExportView, MemberListView, MemberStatsView,
)

urlpatterns = [
    path('', MemberListView.as_view(), name='admin-member-list'),
    path('stats/', MemberStatsView.as_view(), name='admin-member-stats'),
    path('export.csv', MemberExportView.as_view(), name='admin-member-export'),
    path('bulk/', MemberBulkView.as_view(), name='admin-member-bulk'),
    path('<int:user_id>/', MemberDetailView.as_view(), name='admin-member-detail'),
    path('<int:user_id>/activity/', MemberActivityView.as_view(), name='admin-member-activity'),
    path('<int:user_id>/actions/', MemberActionView.as_view(), name='admin-member-actions'),
]
