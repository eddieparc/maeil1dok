import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000400_catchup_one_active_session_per_subscription.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

describe('catchup_sessions one active session per subscription migration', () => {
  it('fails before adding an index when duplicate active sessions already exist', () => {
    const sql = readMigration()
    const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
    const duplicatePreflight = doBlocks.find((block) =>
      /public\.catchup_sessions/i.test(block)
    )

    expect(duplicatePreflight).toBeDefined()
    expect(duplicatePreflight).toMatch(/FROM\s+public\.catchup_sessions/i)
    expect(duplicatePreflight).toMatch(/WHERE\s+status\s*=\s*'active'/i)
    expect(duplicatePreflight).toMatch(/GROUP\s+BY\s+subscription_id/i)
    expect(duplicatePreflight).toMatch(/HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1/i)
  })

  it('raises a count-only exception for duplicate active subscriptions', () => {
    const sql = readMigration()
    const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
    const duplicatePreflight = doBlocks.find((block) =>
      /public\.catchup_sessions/i.test(block)
    )
    const exception = duplicatePreflight?.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(exception).toMatch(/,\s*\w*count\w*\s*;/i)
    expect(duplicatePreflight).not.toMatch(/ARRAY_AGG|JSON_AGG|STRING_AGG/i)
  })

  it('raises only when the duplicate count is positive', () => {
    const sql = readMigration()
    const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
    const duplicatePreflight = doBlocks.find((block) =>
      /public\.catchup_sessions/i.test(block)
    )
    const duplicateCount = duplicatePreflight?.match(
      /INTO\s+(\w*count\w*)/i
    )?.[1]

    expect(duplicateCount).toBeDefined()
    if (duplicateCount === undefined) {
      throw new Error('Duplicate preflight must store its duplicate count')
    }

    expect(duplicatePreflight).toMatch(
      new RegExp(
        `IF\\s+${duplicateCount}\\s*>\\s*0\\s+THEN\\s+RAISE\\s+EXCEPTION`,
        'i'
      )
    )
  })

  it('creates a unique partial index for active sessions only', () => {
    const sql = readMigration()

    expect(sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:\w+|"[^"]+")\s+ON\s+public\.catchup_sessions\s*\(\s*subscription_id\s*\)\s+WHERE\s+status\s*=\s*'active'/i
    )
  })

  it('runs the duplicate preflight before creating the unique index', () => {
    const sql = readMigration()
    const duplicatePreflight = sql.match(
      /DO\s+\$\$[\s\S]*?public\.catchup_sessions[\s\S]*?\$\$\s*;/i
    )?.[0]
    const uniqueIndex = sql.match(
      /CREATE\s+UNIQUE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:\w+|"[^"]+")\s+ON\s+public\.catchup_sessions/i
    )?.[0]

    expect(duplicatePreflight).toBeDefined()
    expect(uniqueIndex).toBeDefined()
    expect(sql.indexOf(duplicatePreflight ?? '')).toBeLessThan(
      sql.indexOf(uniqueIndex ?? '')
    )
  })

  it('does not make subscription_id unique for inactive sessions', () => {
    const sql = readMigration()

    expect(sql).not.toMatch(
      /ALTER\s+TABLE\s+public\.catchup_sessions[\s\S]*?ADD\s+CONSTRAINT[\s\S]*?UNIQUE\s*\(\s*subscription_id\s*\)/i
    )
    expect(sql).not.toMatch(
      /CREATE\s+UNIQUE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:\w+|"[^"]+")\s+ON\s+public\.catchup_sessions\s*\(\s*subscription_id\s*\)\s*;/i
    )
  })
})
