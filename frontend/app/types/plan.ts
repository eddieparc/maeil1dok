/**
 * Plan Types
 *
 * 플랜/구독/일정 관련 모든 타입 정의를 중앙 집중화
 */

// ============================================
// Core Plan Types
// ============================================

/**
 * 읽기 플랜 기본 정보
 */
export interface Plan {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  subscriber_count: number;
}

/**
 * 사용자의 플랜 구독 정보
 */
export interface Subscription {
  id: number;
  plan_id: number;
  plan_name: string;
  start_date: string;
  is_active: boolean;
  plan_is_active?: boolean;
  is_default: boolean;
}

/**
 * BibleScheduleContent 내부에서 사용하는 간소화된 구독 타입
 */
export interface SubscriptionSummary {
  plan_id: number;
  plan_name: string;
  is_default?: boolean;
}

// ============================================
// Schedule Types
// ============================================

/**
 * 일일 성경 읽기 일정
 */
export interface Schedule {
  id: number;
  date: string;
  book: string;
  start_chapter: number;
  end_chapter: number;
  is_completed: boolean;
}

/**
 * 날짜별로 그룹화된 일정
 */
export type GroupedSchedules = Record<string, Schedule[]>;

// ============================================
// Reading Status Types
// ============================================

/**
 * 일정의 읽기 상태
 */
export type ReadingStatus = 'completed' | 'not_completed' | 'current' | 'upcoming';

/**
 * 읽기 상태 업데이트 액션
 */
export type ReadingAction = 'complete' | 'cancel';

// ============================================
// Bulk Edit Types
// ============================================

/**
 * 일괄 수정 상태
 */
export interface BulkEditState {
  firstSchedule: Schedule | null;
  secondSchedule: Schedule | null;
  message: string;
  showActions: boolean;
}

/**
 * 일괄 수정 이벤트 페이로드
 */
export interface RangeSelectPayload {
  action: ReadingAction;
  startSchedule: Schedule;
  endSchedule: Schedule;
  scheduleIds: number[];
  planId: number | null;
}

// ============================================
// API Response Types
// ============================================

/**
 * 사용자 플랜 조회 응답
 */
export interface UserPlansResponse {
  subscriptions: Subscription[];
  available_plans: Plan[];
}

/**
 * 다음 읽기 위치 응답
 */
export interface NextPositionResponse {
  success: boolean;
  status: 'next_incomplete' | 'all_completed' | 'today' | 'nearest' | 'no_schedule' | 'error';
  date?: string;
  month?: number;
  schedule_id?: number;
  message?: string;
}

/**
 * 읽기 상태 업데이트 요청
 */
export interface ReadingUpdateRequest {
  plan_id: number;
  schedule_ids: number[];
  action: ReadingAction;
}

/**
 * 현재 읽기 위치 응답
 */
export interface CurrentPositionResponse {
  plan_date: string;
  book: string;
  chapter: number;
}

// ============================================
// UI State Types
// ============================================

/**
 * 스크롤 타겟 타입
 */
export type ScrollTarget = 'today' | 'lastIncomplete' | 'currentLocation';

/**
 * 일정 상태 텍스트 매핑
 */
export const STATUS_TEXT: Record<ReadingStatus, string> = {
  completed: '읽음',
  not_completed: '미완료',
  current: '오늘',
  upcoming: '예정',
} as const;

// ============================================
// Constants
// ============================================

/**
 * 기본 일괄 수정 상태
 */
export const DEFAULT_BULK_EDIT_STATE: BulkEditState = {
  firstSchedule: null,
  secondSchedule: null,
  message: '첫번째 일정을 선택해주세요',
  showActions: false,
};

/**
 * 애니메이션 딜레이 상수 (ms)
 */
export const ANIMATION_DELAYS = {
  DEFAULT_PLAN_MESSAGE_SHOW: 500,
  DEFAULT_PLAN_MESSAGE_HIDE: 5000,
  SCROLL_TO_CURRENT: 800,
} as const;
