/**
 * Date formatting composable
 * 날짜 포맷 관련 유틸리티 함수들을 제공합니다.
 *
 * 포맷 로직 자체는 `~/utils/dateFormat`이 단일 원천이다 — 이 composable은
 * 기존 호출부 시그니처(string 입력)를 유지하는 얇은 래퍼다.
 */
import { formatKoreanDate, formatMonthDay } from '~/utils/dateFormat'

export const useDateFormat = () => {
  /**
   * 상대적 날짜 포맷 (오늘, 어제, N일 전, N주 전)
   * 30일 이상인 경우 짧은 날짜 포맷 (1월 1일)
   */
  const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return formatMonthDay(date);
  };

  /**
   * 짧은 날짜 포맷 (1월 1일)
   */
  const formatShortDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    return formatMonthDay(dateStr);
  };

  /**
   * 전체 날짜 포맷 (2024년 1월 1일)
   */
  const formatFullDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    return formatKoreanDate(dateStr);
  };

  return {
    formatRelativeDate,
    formatShortDate,
    formatFullDate,
  };
};
