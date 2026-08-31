"""
API Response Standardization Utilities
모든 API 응답을 일관된 형식으로 반환하기 위한 유틸리티
"""

from rest_framework.response import Response
from rest_framework import status
from typing import Any, Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class StandardResponse:
    """표준화된 API 응답 클래스"""
    
    @staticmethod
    def success(
        data: Any = None,
        message: str = "요청이 성공적으로 처리되었습니다.",
        status_code: int = status.HTTP_200_OK,
        **kwargs
    ) -> Response:
        """
        성공 응답 생성
        
        Args:
            data: 응답 데이터
            message: 성공 메시지
            status_code: HTTP 상태 코드
            **kwargs: 추가 필드
        
        Returns:
            Response: 표준화된 성공 응답
        """
        response_data = {
            "success": True,
            "message": message,
            "data": data,
            **kwargs
        }
        
        # None 값 제거
        response_data = {k: v for k, v in response_data.items() if v is not None}
        
        return Response(response_data, status=status_code)
    
    @staticmethod
    def error(
        error: str,
        message: str = "요청 처리 중 오류가 발생했습니다.",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        errors: Optional[Dict] = None,
        **kwargs
    ) -> Response:
        """
        에러 응답 생성
        
        Args:
            error: 에러 메시지
            message: 사용자 친화적 메시지
            status_code: HTTP 상태 코드
            errors: 상세 에러 정보
            **kwargs: 추가 필드
        
        Returns:
            Response: 표준화된 에러 응답
        """
        response_data = {
            "success": False,
            "message": message,
            "error": error,
            "errors": errors,
            **kwargs
        }
        
        # None 값 제거
        response_data = {k: v for k, v in response_data.items() if v is not None}
        
        log = logger.error if status_code >= 500 else logger.warning
        log(
            "api_error",
            extra={
                "event": "api_error",
                "status": status_code,
            },
        )
        
        return Response(response_data, status=status_code)
    
    @staticmethod
    def paginated(
        data: List,
        page: int,
        total_pages: int,
        total_count: int,
        message: str = "데이터를 성공적으로 조회했습니다.",
        **kwargs
    ) -> Response:
        """
        페이지네이션된 응답 생성
        
        Args:
            data: 데이터 리스트
            page: 현재 페이지
            total_pages: 전체 페이지 수
            total_count: 전체 데이터 수
            message: 성공 메시지
            **kwargs: 추가 필드
        
        Returns:
            Response: 표준화된 페이지네이션 응답
        """
        response_data = {
            "success": True,
            "message": message,
            "data": data,
            "pagination": {
                "page": page,
                "total_pages": total_pages,
                "total_count": total_count,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            **kwargs
        }
        
        return Response(response_data, status=status.HTTP_200_OK)


def handle_api_exception(func):
    """
    API 예외 처리 데코레이터
    
    모든 예외를 캐치하여 표준화된 에러 응답으로 변환
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Unhandled exception in {func.__name__}")
            return StandardResponse.error(
                error=str(e),
                message="서버 내부 오류가 발생했습니다.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    return wrapper
