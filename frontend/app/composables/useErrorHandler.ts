/**
 * useErrorHandler - 표준화된 에러 핸들링 유틸리티
 *
 * 에러 유형별 일관된 처리를 제공합니다:
 * - API 에러: console.error + toast + (선택) 에러 리포팅
 * - 사용자 액션 에러: 취소 무시 + 폴백 실행
 */

import { useToast } from '~/composables/useToast';
import * as Sentry from '@sentry/nuxt';

interface ErrorHandlerOptions {
  /** 사용자에게 피드백을 표시하지 않음 */
  silent?: boolean;
  /** 토스트 메시지 표시 여부 (기본: true) */
  showToast?: boolean;
  /** 콘솔 로깅 여부 (기본: 개발 환경에서만) */
  logToConsole?: boolean;
}

export function useErrorHandler() {
  const toast = useToast();
  const isDev = process.dev;

  const reportHandledError = (error: unknown, context: string): void => {
    Sentry.withScope((scope) => {
      scope.setTag('handled', 'true');
      scope.setTag('error_context', context);

      const candidate = typeof error === 'object' && error !== null
        ? error as Record<string, unknown>
        : null;
      const status = typeof candidate?.status === 'number'
        ? candidate.status
        : undefined;
      if (status !== undefined) {
        scope.setExtra('http_status', status);
      }

      if (error instanceof Error && (status === undefined || status >= 500)) {
        Sentry.captureException(error);
        return;
      }
      Sentry.captureMessage(`Handled failure: ${context}`, {
        level: status !== undefined && status < 500 ? 'warning' : 'error',
      });
    });
  };

  /**
   * 에러에서 메시지 추출
   */
  const getErrorMessage = (error: unknown): string | null => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null) {
      const e = error as Record<string, unknown>;
      if (typeof e.message === 'string') return e.message;
      // Axios 에러 응답 처리
      if (e.response && typeof e.response === 'object') {
        const resp = e.response as Record<string, unknown>;
        if (resp.data && typeof resp.data === 'object') {
          const data = resp.data as Record<string, unknown>;
          if (typeof data.message === 'string') return data.message;
          if (typeof data.detail === 'string') return data.detail;
          if (typeof data.error === 'string') return data.error;
        }
      }
    }
    return null;
  };

  /**
   * API 에러 처리
   * @param error - 발생한 에러
   * @param context - 에러 컨텍스트 (예: '북마크 삭제', '데이터 로드')
   * @param options - 핸들링 옵션
   */
  const handleApiError = (
    error: unknown,
    context: string,
    options: ErrorHandlerOptions = {}
  ) => {
    const { silent = false, showToast = true, logToConsole = isDev } = options;

    if (logToConsole) {
      console.error(`[API Error] ${context}:`, error);
    }
    if (!isDev) {
      reportHandledError(error, context);
    }

    if (!silent && showToast) {
      const serverMessage = getErrorMessage(error);
      const message = serverMessage || `${context}에 실패했습니다`;
      toast.error(message);
    }

    // 프로덕션 에러 리포팅 (Sentry 등 추후 통합 가능)
    // if (!isDev) reportError(error, context);
  };

  /**
   * 사용자 액션 에러 처리 (취소 가능한 액션)
   * @param error - 발생한 에러
   * @param context - 에러 컨텍스트 (예: '공유', '복사')
   * @param fallback - 에러 발생 시 실행할 폴백 함수
   */
  const handleUserActionError = (
    error: unknown,
    context: string,
    fallback?: () => void | Promise<void>
  ) => {
    // 사용자 취소는 무시 (AbortError)
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }

    if (isDev) {
      console.warn(`[User Action] ${context}:`, error);
    } else {
      reportHandledError(error, context);
    }

    // 폴백 실행
    if (fallback) {
      fallback();
    }
  };

  /**
   * 조용한 에러 처리 (로깅만, 사용자 피드백 없음)
   * @param error - 발생한 에러
   * @param context - 에러 컨텍스트
   */
  const handleSilentError = (error: unknown, context: string) => {
    if (isDev) {
      console.error(`[Silent Error] ${context}:`, error);
    } else {
      reportHandledError(error, context);
    }
  };

  return {
    handleApiError,
    handleUserActionError,
    handleSilentError,
    getErrorMessage,
  };
}
