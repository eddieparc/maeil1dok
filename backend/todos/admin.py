from django.contrib import admin
from .models import CatchupSession, CatchupSchedule, HasenaSummary, NotificationPushSubscription


class CatchupScheduleInline(admin.TabularInline):
    model = CatchupSchedule
    extra = 0
    readonly_fields = ['original_schedule', 'scheduled_date', 'is_completed', 'completed_at']
    can_delete = False


@admin.register(CatchupSession)
class CatchupSessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'subscription', 'strategy', 'status', 'progress_percentage', 'created_at']
    list_filter = ['status', 'strategy', 'created_at']
    search_fields = ['name', 'subscription__user__username', 'subscription__plan__name']
    readonly_fields = ['progress_percentage', 'completed_count', 'total_count', 'created_at', 'updated_at']
    inlines = [CatchupScheduleInline]

    fieldsets = (
        ('기본 정보', {
            'fields': ('subscription', 'name', 'status')
        }),
        ('따라잡기 범위', {
            'fields': ('range_start', 'range_end')
        }),
        ('전략 설정', {
            'fields': ('strategy', 'target_rejoin_date')
        }),
        ('읽기량 설정', {
            'fields': ('max_daily_readings', 'max_daily_chapters', 'weekend_multiplier')
        }),
        ('진행 현황', {
            'fields': ('progress_percentage', 'completed_count', 'total_count', 'completed_at')
        }),
        ('타임스탬프', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CatchupSchedule)
class CatchupScheduleAdmin(admin.ModelAdmin):
    list_display = ['session', 'original_schedule', 'scheduled_date', 'is_completed', 'completed_at']
    list_filter = ['is_completed', 'scheduled_date', 'session__status']
    search_fields = ['session__name', 'original_schedule__book']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(HasenaSummary)
class HasenaSummaryAdmin(admin.ModelAdmin):
    list_display = ['video_id', 'video_date', 'title', 'is_edited', 'model_used', 'updated_at']
    list_filter = ['is_edited', 'model_used', 'video_date']
    search_fields = ['video_id', 'title', 'summary']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-video_date', '-created_at']
    
    fieldsets = (
        ('영상 정보', {
            'fields': ('video_id', 'video_date', 'title')
        }),
        ('AI 요약', {
            'fields': ('summary', 'model_used', 'is_edited')
        }),
        ('원본 자막', {
            'fields': ('transcript',),
            'classes': ('collapse',)
        }),
        ('타임스탬프', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['regenerate_summary']
    
    @admin.action(description='선택한 요약 재생성')
    def regenerate_summary(self, request, queryset):
        from .services.hasena_summary_service import regenerate_summary_for_video
        
        success_count = 0
        for summary in queryset:
            result = regenerate_summary_for_video(summary.video_id)
            if result.get('success'):
                success_count += 1
        
        self.message_user(request, f'{success_count}개의 요약이 재생성되었습니다.')


@admin.register(NotificationPushSubscription)
class NotificationPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'enabled', 'failure_count', 'last_success_at', 'last_failure_at', 'updated_at']
    list_filter = ['enabled', 'created_at', 'updated_at']
    search_fields = ['user__username', 'user__nickname', 'endpoint']
    readonly_fields = ['endpoint', 'p256dh', 'auth', 'created_at', 'updated_at', 'last_success_at', 'last_failure_at']
