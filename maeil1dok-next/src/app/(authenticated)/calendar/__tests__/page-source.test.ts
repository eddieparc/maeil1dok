import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagePath = resolve(__dirname, '../page.tsx')

function readPageSource(): string {
  return readFileSync(pagePath, 'utf8')
}

describe('calendar page batches month data with bulk repository reads', () => {
  const source = readPageSource()

  it('no longer performs per-active-subscription async mapping', () => {
    expect(source).not.toContain('activeSubscriptions.map(async')
  })

  it('no longer calls the single-subscription display-settings method', () => {
    expect(source).not.toContain('getDisplaySettings(sub.id)')
  })

  it('no longer calls the single-plan schedule method', () => {
    expect(source).not.toContain('getSchedulesForPlan(sub.planId')
  })

  it('no longer calls the single-subscription bulk-progress method', () => {
    expect(source).not.toContain('bulkGetProgress(sub.id')
  })

  it('uses the bulk repository methods once each', () => {
    expect(source).toContain('getDisplaySettingsForSubscriptions(subscriptionIds)')
    expect(source).toContain('getSchedulesForPlans(planIds, startDate, endDate)')
    expect(source).toContain('bulkGetProgressForSubscriptions(subscriptionIds, allScheduleIds)')
  })
})
