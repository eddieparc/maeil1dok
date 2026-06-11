"""인증 민감 엔드포인트 전용 레이트 리밋.

이메일 발송·로그인처럼 무차별 대입이나 스팸 발송에 악용될 수 있는
엔드포인트는 전역 anon 제한(100/hour)보다 더 좁게 제한한다.
"""
from rest_framework.throttling import AnonRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'


class EmailVerificationThrottle(AnonRateThrottle):
    scope = 'email_verification'
