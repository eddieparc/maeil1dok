import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000100_daily_schedules_owned_active_subscription_rls.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('daily_schedules owned active subscription RLS migration', () => {
  it('drops the broad authenticated select policy', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.daily_schedules'
    )
  })

  it('creates a daily_schedules SELECT policy scoped to owned active subscriptions', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"Users can view subscribed active schedules"[\s\S]+ON\s+public\.daily_schedules[\s\S]+FOR\s+SELECT/i
    )
    expect(sql).toContain('ps.user_id = auth.uid()')
    expect(sql).toContain('ps.is_active = true')
    expect(sql).toContain('brp.is_active = true')
    expect(sql).toContain('ps.plan_id = daily_schedules.plan_id')
  })
})
