import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000300_display_settings_subscription_owner_invariant.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('display settings subscription owner invariant migration', () => {
  it('repairs pre-existing owner mismatches before adding the composite FK', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /UPDATE\s+public\.user_plan_display_settings\s+uds[\s\S]+SET\s+user_id\s*=\s*ps\.user_id/i
    )
    expect(sql).toMatch(
      /FROM\s+public\.plan_subscriptions\s+ps[\s\S]+uds\.subscription_id\s*=\s*ps\.id[\s\S]+uds\.user_id\s*<>\s*ps\.user_id/i
    )
  })

  it('adds the composite unique constraint on plan_subscriptions(id, user_id)', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /ALTER\s+TABLE\s+public\.plan_subscriptions[\s\S]+ADD\s+CONSTRAINT\s+\w+\s+UNIQUE\s*\(\s*id\s*,\s*user_id\s*\)/i
    )
  })

  it('adds the composite FK from display settings to the subscription owner with cascade', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /ALTER\s+TABLE\s+public\.user_plan_display_settings[\s\S]+FOREIGN\s+KEY\s*\(\s*subscription_id\s*,\s*user_id\s*\)[\s\S]+REFERENCES\s+public\.plan_subscriptions\s*\(\s*id\s*,\s*user_id\s*\)[\s\S]+ON\s+DELETE\s+CASCADE/i
    )
  })

  it('drops the broad manage-own display settings policy', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can manage own display settings" ON public.user_plan_display_settings'
    )
  })

  it('creates INSERT and UPDATE policies that match owner and subscription owner', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"Users can insert own display settings"[\s\S]+FOR\s+INSERT[\s\S]+WITH\s+CHECK/i
    )

    const updateBlockMatch = sql.match(
      /CREATE\s+POLICY\s+"Users can update own display settings"[\s\S]+?;\s/i
    )
    expect(updateBlockMatch).not.toBeNull()
    const updateBlock = updateBlockMatch?.[0] ?? ''
    expect(updateBlock).toMatch(/FOR\s+UPDATE/i)
    expect(updateBlock).toMatch(/USING/i)
    expect(updateBlock).toMatch(/WITH\s+CHECK/i)

    // Every new policy binds the row user_id to both auth.uid() and the
    // referenced subscription's owner.
    expect(sql).toMatch(/auth\.uid\(\)\s*=\s*user_plan_display_settings\.user_id/i)
    expect(sql).toMatch(
      /ps\.id\s*=\s*user_plan_display_settings\.subscription_id[\s\S]+ps\.user_id\s*=\s*user_plan_display_settings\.user_id/i
    )
  })

  it('creates explicit SELECT and DELETE owner-scoped policies', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"Users can view own display settings"[\s\S]+FOR\s+SELECT[\s\S]+USING/i
    )
    expect(sql).toMatch(
      /CREATE\s+POLICY\s+"Users can delete own display settings"[\s\S]+FOR\s+DELETE[\s\S]+USING/i
    )
  })
})
