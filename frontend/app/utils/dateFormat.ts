/**
 * 날짜 포맷팅 유틸리티 함수들
 */

/**
 * 날짜를 YYYY.MM.DD 형식으로 포맷
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}.${month}.${day}`
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷 (input[type=date]용)
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return ''

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}


/**
 * 날짜를 로컬 시간대 기준 YYYY-MM-DD 문자열로 변환 (API 날짜 키/조회용)
 *
 * `Date.prototype.toISOString()`은 UTC 기준이라 KST(UTC+9)에서는 자정~오전 9시
 * 사이에 하루 이전 날짜를 반환한다. 또한 `new Date(year, month, day)`처럼 로컬
 * 자정으로 만든 Date를 toISOString하면 항상 전날로 밀린다. 이 함수는 로컬 달력
 * 구성요소를 그대로 사용해 서버(KST)의 날짜 키와 일치시킨다.
 *
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 로컬 기준 YYYY-MM-DD 문자열 또는 빈 문자열
 */
export function toLocalDateString(date: Date | string | null | undefined): string {
  return formatDateForInput(date)
}

/**
 * 오늘 날짜를 로컬 시간대 기준 YYYY-MM-DD 문자열로 반환
 *
 * `new Date().toISOString().split('T')[0]`(UTC)의 KST off-by-one을 방지한다.
 *
 * @returns 로컬 기준 오늘 날짜 YYYY-MM-DD 문자열
 */
export function getTodayString(): string {
  return formatDateForInput(new Date())
}

/**
 * 날짜를 MM/DD 형식으로 포맷
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return ''

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const month = d.getMonth() + 1
  const day = d.getDate()

  return `${month}/${day}`
}

/**
 * 날짜를 YYYY년 M월 D일 형식으로 포맷
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatKoreanDate(date: Date | string | null | undefined): string {
  if (!date) return ''

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/**
 * 오늘 날짜인지 확인
 * @param date Date 객체 또는 ISO 문자열
 * @returns 오늘이면 true
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()

  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

/**
 * Date | string | null | undefined 입력을 유효한 Date로 정규화.
 * 유효하지 않으면 null을 반환한다.
 */
function toDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return isNaN(d.getTime()) ? null : d
}

/**
 * 날짜를 M월 D일 형식으로 포맷 (예: 1월 5일)
 *
 * `toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })`와 동일한 출력.
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatMonthDay(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 날짜를 M월 D일 (요일) 형식으로 포맷 (예: 1월 5일 (월))
 *
 * `toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })`와
 * 동일한 출력.
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatMonthDayWeekday(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_NAMES[d.getDay()]})`
}

/**
 * 날짜를 YYYY년 M월 형식으로 포맷 (예: 2026년 1월)
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatYearMonth(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

/**
 * 날짜를 YYYY년 M월 D일 요일 형식으로 포맷 (예: 2026년 1월 5일 월)
 *
 * `toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })`와
 * 동일한 출력.
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export function formatFullDateWeekday(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 시각을 오전/오후 HH:MM 형식으로 포맷 (예: 오후 02:30)
 *
 * 브라우저의 `Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' })`와
 * 동일한 출력. 수동 구현인 이유: small-ICU Node(테스트 러너)에서는 ko-KR
 * dayPeriod가 'PM'처럼 영어로 폴백되어 런타임마다 결과가 달라진다.
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 시각 문자열 또는 빈 문자열
 */
export function formatTime(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  const period = d.getHours() < 12 ? '오전' : '오후'
  const hour12 = d.getHours() % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${period} ${String(hour12).padStart(2, '0')}:${minute}`
}

/**
 * 날짜+시각을 M월 D일 오전/오후 HH:MM 형식으로 포맷 (예: 1월 5일 오후 02:30)
 *
 * 브라우저의 `toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })`와
 * 동일한 출력.
 * @param date Date 객체, ISO 문자열, 또는 null
 * @returns 포맷된 날짜+시각 문자열 또는 빈 문자열
 */
export function formatMonthDayTime(date: Date | string | null | undefined): string {
  const d = toDate(date)
  if (!d) return ''
  return `${formatMonthDay(d)} ${formatTime(d)}`
}
