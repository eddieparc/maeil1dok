import type { components } from '~/types/generated/api-schema'

export type AdminPlan = components['schemas']['BibleReadingPlan']
export type AdminSchedule = components['schemas']['DailyBibleSchedule']
export type PlanFields = Pick<AdminPlan, 'name' | 'description'>
export type ScheduleFields = Pick<AdminSchedule, 'date' | 'book' | 'start_chapter' | 'end_chapter' | 'audio_link' | 'guide_link'>
export type PlanAdminSubmission =
  | { kind: 'plan'; fields: PlanFields }
  | { kind: 'schedule'; fields: ScheduleFields }
  | { kind: 'upload'; file: File; mode: 'update' | 'replace' }

// DRF field errors and Excel row errors are returned in ApiError.data, while
// transport errors may have no response body. Never discard row diagnostics.
export function planAdminError(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object') {
    const messages = Object.entries(error.data).flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value]
      return values.filter((item): item is string => typeof item === 'string').map(item =>
        ['detail', 'error', 'errors', 'non_field_errors'].includes(key) ? item : `${key}: ${item}`)
    })
    if (messages.length) return messages.join('\n')
  }
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 다시 시도해주세요.'
}

export function scheduleLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
