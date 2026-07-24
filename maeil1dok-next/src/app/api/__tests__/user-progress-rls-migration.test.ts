import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000200_user_progress_active_subscription_schedule_rls.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('user_progress active subscription/schedule RLS migration', () => {
  it('drops all three legacy ownership-only progress policies', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress'
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress'
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress'
    )
  })

  it('recreates SELECT, INSERT, and UPDATE policies on public.user_progress', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.user_progress[\s\S]+FOR\s+SELECT/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.user_progress[\s\S]+FOR\s+INSERT/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"[^"]+"[\s\S]+ON\s+public\.user_progress[\s\S]+FOR\s+UPDATE/i
    )
  })

  it('requires ownership of the referenced subscription', () => {
    const sql = readMigration()

    expect(sql).toContain('ps.id = user_progress.subscription_id')
    expect(sql).toContain('ps.user_id = auth.uid()')
  })

  it('requires the subscription and its plan to be active', () => {
    const sql = readMigration()

    expect(sql).toContain('ps.is_active = true')
    expect(sql).toContain('brp.is_active = true')
    expect(sql).toContain('brp.id = ps.plan_id')
  })

  it('requires the referenced schedule to belong to the subscription plan', () => {
    const sql = readMigration()

    expect(sql).toContain('ds.id = user_progress.schedule_id')
    expect(sql).toContain('ds.plan_id = ps.plan_id')
  })

  it('enforces the invariant on write via WITH CHECK, not only USING', () => {
    const sql = readMigration()

    expect(sql).toMatch(/FOR\s+INSERT[\s\S]+WITH\s+CHECK/i)
    // UPDATE policy must carry both USING and WITH CHECK so rows cannot be
    // mutated into an invalid subscription/schedule pairing.
    const updateBlock = sql.slice(sql.indexOf('FOR UPDATE'))
    expect(updateBlock).toMatch(/USING\s*\(/i)
    expect(updateBlock).toMatch(/WITH\s+CHECK\s*\(/i)
  })

  it('pins every required predicate so removing one fails the test', () => {
    const sql = readMigration()

    for (const predicate of [
      'ps.id = user_progress.subscription_id',
      'ps.user_id = auth.uid()',
      'ps.is_active = true',
      'brp.is_active = true',
      'brp.id = ps.plan_id',
      'ds.id = user_progress.schedule_id',
      'ds.plan_id = ps.plan_id',
    ]) {
      expect(sql).toContain(predicate)
    }
  })
})
