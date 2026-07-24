import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000900_plan_subscriptions_active_plan_rls.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('plan_subscriptions active-plan RLS migration', () => {
  it('drops the legacy insert and update ownership-only policies', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.plan_subscriptions'
    )
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.plan_subscriptions'
    )
  })

  it('creates an INSERT policy that requires ownership AND an active referenced plan', () => {
    const sql = readMigration()

    const insertMatch = sql.match(
      /CREATE\s+POLICY\s+"[^"]*insert[^"]*"\s+ON\s+public\.plan_subscriptions[\s\S]+?;\s/i
    )
    expect(insertMatch).not.toBeNull()
    const insertBlock = insertMatch?.[0] ?? ''

    expect(insertBlock).toMatch(/FOR\s+INSERT/i)
    expect(insertBlock).toMatch(/WITH\s+CHECK/i)
    expect(insertBlock).toMatch(/auth\.uid\(\)\s*=\s*plan_subscriptions\.user_id/i)
    expect(insertBlock).toMatch(/brp\.id\s*=\s*plan_subscriptions\.plan_id/i)
    expect(insertBlock).toMatch(/brp\.is_active\s*=\s*true/i)
  })

  it('creates an UPDATE policy with both USING and WITH CHECK', () => {
    const sql = readMigration()

    const updateMatch = sql.match(
      /CREATE\s+POLICY\s+"[^"]*update[^"]*"\s+ON\s+public\.plan_subscriptions[\s\S]+?;\s/i
    )
    expect(updateMatch).not.toBeNull()
    const updateBlock = updateMatch?.[0] ?? ''

    expect(updateBlock).toMatch(/FOR\s+UPDATE/i)
    expect(updateBlock).toMatch(/USING\s*\(\s*auth\.uid\(\)\s*=\s*plan_subscriptions\.user_id\s*\)/i)
    expect(updateBlock).toMatch(/WITH\s+CHECK/i)
  })

  it('UPDATE WITH CHECK preserves owner binding, allows deactivation, and blocks active rows for inactive plans', () => {
    const sql = readMigration()

    const updateMatch = sql.match(
      /CREATE\s+POLICY\s+"[^"]*update[^"]*"\s+ON\s+public\.plan_subscriptions[\s\S]+?;\s/i
    )
    const updateBlock = updateMatch?.[0] ?? ''

    // Owner binding stays.
    expect(updateBlock).toMatch(/auth\.uid\(\)\s*=\s*plan_subscriptions\.user_id/i)
    // Explicitly allow deactivating own subscription.
    expect(updateBlock).toMatch(/plan_subscriptions\.is_active\s*=\s*false/i)
    // Otherwise require the referenced plan to be active.
    expect(updateBlock).toMatch(/brp\.id\s*=\s*plan_subscriptions\.plan_id/i)
    expect(updateBlock).toMatch(/brp\.is_active\s*=\s*true/i)
  })
})
