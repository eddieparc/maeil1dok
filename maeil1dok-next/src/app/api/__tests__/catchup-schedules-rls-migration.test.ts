import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000500_catchup_schedule_original_plan_rls.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('catchup_schedules original-plan RLS migration', () => {
  it('drops both legacy ownership-only catchup schedule policies', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can view own catchup schedules" ON public.catchup_schedules'
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can manage own catchup schedules" ON public.catchup_schedules'
    )
  })

  it('recreates SELECT, INSERT, UPDATE, and DELETE policies on public.catchup_schedules', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.catchup_schedules[\s\S]+FOR\s+SELECT/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.catchup_schedules[\s\S]+FOR\s+INSERT/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.catchup_schedules[\s\S]+FOR\s+UPDATE/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.catchup_schedules[\s\S]+FOR\s+DELETE/i
    )
  })

  it('enforces write invariants via WITH CHECK on INSERT and UPDATE', () => {
    const sql = readMigration()

    const insertBlock = sql.slice(sql.indexOf('FOR INSERT'))
    expect(insertBlock).toMatch(/WITH\s+CHECK\s*\(/i)

    const updateBlock = sql.slice(sql.indexOf('FOR UPDATE'), sql.indexOf('FOR DELETE'))
    expect(updateBlock).toMatch(/USING\s*\(/i)
    expect(updateBlock).toMatch(/WITH\s+CHECK\s*\(/i)
  })

  it('requires the authenticated owner through the session subscription', () => {
    const sql = readMigration()

    expect(sql).toContain('cs.id = catchup_schedules.session_id')
    expect(sql).toContain('ps.id = cs.subscription_id')
    expect(sql).toContain('ps.user_id = auth.uid()')
  })

  it('binds original_schedule_id to a daily schedule in the subscription plan', () => {
    const sql = readMigration()

    expect(sql).toContain('ds.id = catchup_schedules.original_schedule_id')
    expect(sql).toContain('ds.plan_id = ps.plan_id')
  })

  it('still allows a null original_schedule_id', () => {
    const sql = readMigration()

    expect(sql).toContain('catchup_schedules.original_schedule_id IS NULL')
  })

  it('pins every required predicate so removing one fails the test', () => {
    const sql = readMigration()

    for (const predicate of [
      'cs.id = catchup_schedules.session_id',
      'ps.id = cs.subscription_id',
      'ps.user_id = auth.uid()',
      'catchup_schedules.original_schedule_id IS NULL',
      'ds.id = catchup_schedules.original_schedule_id',
      'ds.plan_id = ps.plan_id',
    ]) {
      expect(sql).toContain(predicate)
    }
  })
})
