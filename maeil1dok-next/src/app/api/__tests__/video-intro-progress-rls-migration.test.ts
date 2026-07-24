import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000600_video_intro_progress_active_subscription_rls.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('user_video_intro_progress active subscription RLS migration', () => {
  it('drops the legacy ownership-only policy', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Users can manage own video progress" ON public.user_video_intro_progress'
    )
  })

  it('recreates SELECT, INSERT, UPDATE, and DELETE policies', () => {
    const sql = readMigration()

    for (const command of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE\\s+POLICY\\s+"[^"]+"[\\s\\S]+ON\\s+public\\.user_video_intro_progress[\\s\\S]+FOR\\s+${command}`,
          'i'
        )
      )
    }
  })

  it('enforces INSERT via WITH CHECK', () => {
    const sql = readMigration()

    expect(sql).toMatch(/FOR\s+INSERT[\s\S]+WITH\s+CHECK/i)
  })

  it('enforces UPDATE with both USING and WITH CHECK', () => {
    const sql = readMigration()

    const updateBlock = sql.slice(sql.indexOf('FOR UPDATE'), sql.indexOf('FOR DELETE'))
    expect(updateBlock).toMatch(/USING\s*\(/i)
    expect(updateBlock).toMatch(/WITH\s+CHECK\s*\(/i)
  })

  it('pins every required owner, subscription, plan, and intro-plan predicate', () => {
    const sql = readMigration()

    for (const predicate of [
      'user_video_intro_progress.user_id = auth.uid()',
      'vbi.id = user_video_intro_progress.video_intro_id',
      'ps.user_id = auth.uid()',
      'ps.plan_id = vbi.plan_id',
      'ps.is_active = true',
      'brp.id = vbi.plan_id',
      'brp.is_active = true',
    ]) {
      expect(sql).toContain(predicate)
    }
  })

  it('rebinds get_daily_status.intro_completed to active subscribed active plans', () => {
    const sql = readMigration()

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_daily_status')
    const introBlock = sql.slice(sql.indexOf('intro_completed'))
    expect(introBlock).toContain('public.plan_subscriptions')
    expect(introBlock).toContain('public.bible_reading_plans')
    expect(introBlock).toContain('ps.is_active = true')
    expect(introBlock).toContain('brp.is_active = true')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_daily_status(UUID, DATE) TO authenticated')
  })
})
