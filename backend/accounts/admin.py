from django.contrib import admin, messages
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.db import transaction
from django.db.models import Q
from django.template.response import TemplateResponse
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from todos.models import BibleReadingPlan, Notification, PlanSubscription

User = get_user_model()


def _short_datetime(value):
    if value is None:
        return '-'
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime('%Y-%m-%d %H:%M')


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'member_name',
        'email_address',
        'login_methods',
        'account_status',
        'recent_login',
        'joined_at',
    )
    list_display_links = ('member_name',)
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = (
        'nickname',
        'email',
        'username',
        'social_accounts__provider_id',
    )
    ordering = ('-date_joined',)
    actions = ('purge_selected_members',)
    list_per_page = 50

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('social_accounts')

    def changelist_view(self, request, extra_context=None):
        context = {'title': '회원 관리', **(extra_context or {})}
        return super().changelist_view(request, extra_context=context)

    @admin.display(description='회원', ordering='nickname')
    def member_name(self, user):
        return user.nickname

    @admin.display(description='이메일', ordering='email')
    def email_address(self, user):
        return user.email or '-'

    @admin.display(description='로그인 수단')
    def login_methods(self, user):
        methods = []
        if user.has_password_set():
            methods.append('일반')

        provider_labels = {
            'kakao': '카카오',
            'google': '구글',
            'apple': '애플',
        }
        providers = {
            account.provider
            for account in user.social_accounts.all()
        }
        if user.is_social and user.social_provider:
            providers.add(user.social_provider)

        methods.extend(
            provider_labels.get(provider, provider)
            for provider in sorted(providers)
        )
        return ', '.join(methods) or '없음'

    @admin.display(boolean=True, description='활성', ordering='is_active')
    def account_status(self, user):
        return user.is_active

    @admin.display(description='최근 로그인', ordering='last_login')
    def recent_login(self, user):
        return _short_datetime(user.last_login)

    @admin.display(description='가입일', ordering='date_joined')
    def joined_at(self, user):
        return _short_datetime(user.date_joined)

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        if not request.user.is_superuser:
            actions.pop('purge_selected_members', None)
        return actions

    @admin.action(description='선택 회원과 모든 연관 데이터 영구 삭제')
    def purge_selected_members(self, request, queryset):
        selected_ids = set(queryset.values_list('pk', flat=True))
        purge_ids = set(selected_ids)
        pending_ids = set(selected_ids)

        while pending_ids:
            merged_ids = set(
                User.objects.filter(
                    merged_into_id__in=pending_ids,
                ).values_list('pk', flat=True)
            )
            pending_ids = merged_ids - purge_ids
            purge_ids.update(pending_ids)

        protected_exists = User.objects.filter(
            pk__in=purge_ids,
        ).filter(
            Q(is_staff=True) | Q(is_superuser=True),
        ).exists()
        if protected_exists or request.user.pk in purge_ids:
            self.message_user(
                request,
                '현재 관리자 또는 권한 계정은 영구 삭제할 수 없습니다.',
                level=messages.ERROR,
            )
            return None

        if request.POST.get('confirm_purge') != 'yes':
            context = {
                **self.admin_site.each_context(request),
                'title': '회원 영구 삭제 확인',
                'opts': self.model._meta,
                'selected_users': User.objects.filter(
                    pk__in=selected_ids,
                ).order_by('pk'),
                'merged_users': User.objects.filter(
                    pk__in=purge_ids - selected_ids,
                ).order_by('pk'),
                'selected_ids': selected_ids,
                'action_checkbox_name': ACTION_CHECKBOX_NAME,
                'action_name': 'purge_selected_members',
                'purge_count': len(purge_ids),
                'shared_plan_subscription_count': (
                    PlanSubscription.objects.filter(
                        plan__created_by_id__in=purge_ids,
                    ).exclude(
                        user_id__in=purge_ids,
                    ).count()
                ),
            }
            return TemplateResponse(
                request,
                'admin/accounts/user/purge_confirmation.html',
                context,
            )

        with transaction.atomic():
            BibleReadingPlan.objects.filter(created_by_id__in=purge_ids).delete()
            Notification.objects.filter(actor_id__in=purge_ids).delete()
            OutstandingToken.objects.filter(user_id__in=purge_ids).delete()
            User.objects.filter(pk__in=purge_ids).delete()

        self.message_user(
            request,
            f'회원 {len(purge_ids)}명과 연관 데이터를 영구 삭제했습니다.',
            level=messages.SUCCESS,
        )
        return None
