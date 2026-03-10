import { getBookCode } from './constants'

/**
 * 성경 네비게이션 URL 생성을 위한 파라미터
 */
interface ScheduleNavParams {
  book: string // 한글 성경 이름 (예: "창세기")
  startChapter: number // 시작 장
  id: string // 스케줄 ID (UUID)
  planId: number // 플랜 ID
}

/**
 * 성경 읽기 스케줄 정보로부터 성경 네비게이션 URL을 생성합니다.
 *
 * @param schedule - 스케줄 정보
 * @returns 생성된 URL 또는 null (책 이름이 유효하지 않은 경우)
 *
 * @example
 * buildBibleNavigationUrl({
 *   book: '창세기',
 *   startChapter: 2,
 *   id: 'abc-123',
 *   planId: 1
 * })
 * // => '/bible?book=gen&chapter=2&tongdok=true&schedule=abc-123&plan=1'
 */
export function buildBibleNavigationUrl(schedule: ScheduleNavParams): string | null {
  const bookCode = getBookCode(schedule.book)

  if (!bookCode) {
    return null
  }

  return `/bible?book=${bookCode}&chapter=${schedule.startChapter}&tongdok=true&schedule=${schedule.id}&plan=${schedule.planId}`
}
