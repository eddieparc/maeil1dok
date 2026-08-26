from django.apps import AppConfig


class AuthMetricsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'authmetrics'
    verbose_name = '인증 마이그레이션 지표'
