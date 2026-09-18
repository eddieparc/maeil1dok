/**
 * 통독 모드에서 일정의 마지막 장에 도달했을 때 '다음 장' 버튼의 동작을 결정한다.
 *
 * - 이미 완료된 일정: 모달 없이 그냥 다음 장으로 이동 ('navigate')
 * - 미완료 일정 + 저장된 선택: 저장된 다음 일정 액션 재생 ('saved')
 * - 미완료 일정 + 저장된 선택 없음: 다음 일정 이동 모달 표시 ('modal')
 */
export type TongdokLastChapterAction = 'navigate' | 'saved' | 'modal';

export interface TongdokLastChapterInput {
  isScheduleCompleted: boolean;
  savedNextScheduleAction: string | null;
}

export function selectTongdokLastChapterAction(
  input: TongdokLastChapterInput,
): TongdokLastChapterAction {
  if (input.isScheduleCompleted) return 'navigate';
  return input.savedNextScheduleAction ? 'saved' : 'modal';
}
