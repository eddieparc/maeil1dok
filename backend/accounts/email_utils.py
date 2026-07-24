"""
이메일 발송 유틸리티 (Resend 사용)
"""
import resend
import logging
from django.conf import settings

from config.observability import capture_observability_event

logger = logging.getLogger(__name__)

# Resend API 키 설정
resend.api_key = getattr(settings, 'RESEND_API_KEY', None)

# 발신자 이메일 (Resend에서 인증된 도메인 필요)
FROM_EMAIL = getattr(settings, 'FROM_EMAIL', 'noreply@maeil1dok.app')
FROM_NAME = getattr(settings, 'FROM_NAME', '매일일독')

# 프론트엔드 URL (이메일 내 링크용)
FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'https://maeil1dok.app')


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    *,
    purpose: str = 'generic',
) -> bool:
    """
    Resend를 통해 이메일 발송
    
    Args:
        to_email: 수신자 이메일
        subject: 이메일 제목
        html_content: HTML 본문
    
    Returns:
        bool: 발송 성공 여부
    """
    if not resend.api_key:
        logger.warning("Email delivery failed purpose=%s reason=missing_api_key", purpose)
        capture_observability_event(
            'account email delivery failed',
            level='error',
            tags={
                'journey': 'account_email',
                'email_purpose': purpose,
                'outcome': 'failed',
                'reason': 'missing_api_key',
            },
            extra={},
            isolate_request_context=True,
        )
        return False
    
    try:
        params = {
            "from": f"{FROM_NAME} <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        response = resend.Emails.send(params)
        logger.info(
            "Email delivery succeeded purpose=%s response_id=%s",
            purpose,
            response.get('id'),
        )
        return True
        
    except Exception as e:
        error_class = e.__class__.__name__
        logger.warning(
            "Email delivery failed purpose=%s error_class=%s",
            purpose,
            error_class,
        )
        capture_observability_event(
            'account email delivery failed',
            level='error',
            tags={
                'journey': 'account_email',
                'email_purpose': purpose,
                'outcome': 'failed',
                'reason': 'provider_exception',
            },
            extra={'error_class': error_class},
            isolate_request_context=True,
        )
        return False


def send_verification_email(to_email: str, token: str, nickname: str = None) -> bool:
    """
    이메일 인증 메일 발송
    
    Args:
        to_email: 수신자 이메일
        token: 인증 토큰
        nickname: 사용자 닉네임 (선택)
    
    Returns:
        bool: 발송 성공 여부
    """
    verification_url = f"{FRONTEND_URL}/auth/verify-email?token={token}"
    
    greeting = f"{nickname}님, 안녕하세요!" if nickname else "안녕하세요!"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이메일 인증 - 매일일독</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="padding: 40px 30px; text-align: center; background-color: #4F46E5;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">매일일독</h1>
                    <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 14px;">매일 성경을 읽는 습관</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 22px;">{greeting}</h2>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        매일일독에 가입해 주셔서 감사합니다.<br>
                        아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                            <td style="text-align: center;">
                                <a href="{verification_url}" 
                                   style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                                    이메일 인증하기
                                </a>
                            </td>
                        </tr>
                    </table>
                    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                        버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
                        <a href="{verification_url}" style="color: #4F46E5; word-break: break-all;">{verification_url}</a>
                    </p>
                    <p style="color: #9CA3AF; font-size: 14px; margin: 20px 0 0 0;">
                        ⏰ 이 링크는 24시간 동안만 유효합니다.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; background-color: #F9FAFB; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                        본 메일은 매일일독 회원가입 시 요청된 이메일 인증 메일입니다.<br>
                        회원가입을 요청하지 않으셨다면 이 메일을 무시해 주세요.
                    </p>
                    <p style="color: #9CA3AF; font-size: 12px; margin: 15px 0 0 0;">
                        © 매일일독
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return send_email(
        to_email=to_email,
        subject="[매일일독] 이메일 인증을 완료해 주세요",
        html_content=html_content,
        purpose='email_verification',
    )


def send_password_reset_email(to_email: str, token: str, nickname: str = None) -> bool:
    """
    비밀번호 재설정 메일 발송
    
    Args:
        to_email: 수신자 이메일
        token: 재설정 토큰
        nickname: 사용자 닉네임 (선택)
    
    Returns:
        bool: 발송 성공 여부
    """
    reset_url = f"{FRONTEND_URL}/auth/reset-password?token={token}"
    
    greeting = f"{nickname}님, 안녕하세요!" if nickname else "안녕하세요!"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 재설정 - 매일일독</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="padding: 40px 30px; text-align: center; background-color: #4F46E5;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">매일일독</h1>
                    <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 14px;">매일 성경을 읽는 습관</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 22px;">{greeting}</h2>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        비밀번호 재설정을 요청하셨습니다.<br>
                        아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                            <td style="text-align: center;">
                                <a href="{reset_url}" 
                                   style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                                    비밀번호 재설정하기
                                </a>
                            </td>
                        </tr>
                    </table>
                    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                        버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
                        <a href="{reset_url}" style="color: #4F46E5; word-break: break-all;">{reset_url}</a>
                    </p>
                    <p style="color: #EF4444; font-size: 14px; margin: 20px 0 0 0;">
                        ⚠️ 이 링크는 1시간 동안만 유효합니다.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; background-color: #F9FAFB; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                        비밀번호 재설정을 요청하지 않으셨다면 이 메일을 무시해 주세요.<br>
                        계정 보안에 문제가 있다고 생각되시면 즉시 비밀번호를 변경해 주세요.
                    </p>
                    <p style="color: #9CA3AF; font-size: 12px; margin: 15px 0 0 0;">
                        © 매일일독
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return send_email(
        to_email=to_email,
        subject="[매일일독] 비밀번호 재설정 안내",
        html_content=html_content,
        purpose='password_reset',
    )


def send_welcome_email(to_email: str, nickname: str) -> bool:
    """
    회원가입 완료 환영 이메일 발송
    
    Args:
        to_email: 수신자 이메일
        nickname: 사용자 닉네임
    
    Returns:
        bool: 발송 성공 여부
    """
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>환영합니다 - 매일일독</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <tr>
                <td style="padding: 40px 30px; text-align: center; background-color: #4F46E5;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 환영합니다!</h1>
                    <p style="color: #E0E7FF; margin: 10px 0 0 0; font-size: 14px;">매일일독 가입을 축하드립니다</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 22px;">{nickname}님, 환영합니다!</h2>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        매일일독과 함께 성경통독 여정을 시작하세요.<br>
                        성경통독표를 기반으로 매일매일 읽을 본문을 안내해 드립니다.
                    </p>
                    <div style="background-color: #F3F4F6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="color: #1F2937; margin: 0 0 15px 0; font-size: 16px;">📖 매일일독의 주요 기능</h3>
                        <ul style="color: #4B5563; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                            <li>매일 읽을 성경 본문 가이드</li>
                            <li>하세나하시조 영상 시청</li>
                            <li>개인 통독 진행률 추적</li>
                            <li>성경개론 및 오디오 콘텐츠</li>
                        </ul>
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                            <td style="text-align: center;">
                                <a href="{FRONTEND_URL}" 
                                   style="display: inline-block; padding: 16px 40px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                                    오늘의 본문 읽으러 가기
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; background-color: #F9FAFB; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                        © 매일일독
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return send_email(
        to_email=to_email,
        subject="[매일일독] 가입을 환영합니다! 🎉",
        html_content=html_content,
        purpose='welcome',
    )
