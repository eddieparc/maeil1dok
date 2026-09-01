const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

export const formatNativeAuthError = (
  payload: unknown,
  fallback: string,
): string => {
  if (typeof payload !== 'object' || payload === null) {
    return fallback
  }
  const record = payload as Record<string, unknown>
  const message = typeof record.error === 'string' && record.error.trim()
    ? record.error.trim()
    : fallback
  const requestId = typeof record.request_id === 'string'
    && SAFE_REQUEST_ID.test(record.request_id)
    ? record.request_id
    : ''
  return requestId ? `${message}\n오류 ID: ${requestId}` : message
}
