/**
 * unknown 값을 좁히는 타입 가드 / 접근자.
 *
 * API 응답·JSON.parse 결과처럼 타입이 없는 값을 안전하게 읽을 때 사용한다.
 * (기존에 페이지/컴포저블마다 복사돼 있던 로컬 구현의 단일 원천.)
 */

/**
 * 값이 plain object인지 확인한다. 배열과 null은 제외한다.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * record[key]가 문자열이면 반환, 아니면 null.
 * 빈 문자열 기본값이 필요하면 호출부에서 `|| ''`를 사용한다.
 */
export function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

/**
 * record[key]가 정확히 true인지 확인한다 (truthy가 아니라 === true).
 */
export function getBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

/**
 * record[key]가 숫자면 반환, 아니면 defaultValue(기본 0).
 */
export function getNumber(
  record: Record<string, unknown>,
  key: string,
  defaultValue = 0,
): number {
  const value = record[key]
  return typeof value === 'number' ? value : defaultValue
}
