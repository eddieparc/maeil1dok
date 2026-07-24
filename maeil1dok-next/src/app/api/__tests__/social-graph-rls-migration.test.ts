import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260710000200_follow_insert_public_target_rls.sql')

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('follow insert RLS migration', () => {
  it('requires own follower id and a public target profile for user_follows inserts', () => {
    const sql = readMigration()

    expect(sql).toContain('DROP POLICY IF EXISTS "Users can insert own follows" ON public.user_follows')
    expect(sql).toMatch(/CREATE\s+POLICY\s+"Users can insert own follows"[\s\S]+FOR\s+INSERT/i)
    expect(sql).toContain('auth.uid() = follower_id')
    expect(sql).toMatch(/EXISTS\s*\([\s\S]*FROM\s+public\.profiles\s+target_profile/i)
    expect(sql).toContain('target_profile.user_id = user_follows.following_id')
    expect(sql).toContain('target_profile.is_public = true')
  })
})
