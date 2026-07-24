import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711001100_catchup_session_terminal_status_invariant.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

function getPreflight(sql: string): string {
  const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
  const preflight = doBlocks.find((block) => /FROM\s+public\.catchup_sessions/i.test(block))

  if (preflight === undefined) {
    throw new Error('Migration must preflight inconsistent catchup_sessions rows')
  }

  return preflight
}

describe('catchup_sessions status/completed_at consistency invariant migration', () => {
  it('targets public.catchup_sessions', () => {
    const sql = readMigration()
    expect(sql).toMatch(/public\.catchup_sessions/i)
    expect(getPreflight(sql)).toMatch(/FROM\s+public\.catchup_sessions/i)
  })

  it('locks the table before preflight and constraint work', () => {
    const sql = readMigration()
    const tableLock = sql.match(
      /LOCK\s+TABLE\s+public\.catchup_sessions\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE\s*;/i
    )?.[0]
    const preflight = getPreflight(sql)
    const constraint = sql.match(
      /ADD\s+CONSTRAINT\s+catchup_sessions_status_completed_at_consistency/i
    )?.[0]

    expect(tableLock).toBeDefined()
    expect(constraint).toBeDefined()

    const lockIndex = sql.indexOf(tableLock ?? '')
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(lockIndex).toBeLessThan(sql.indexOf(preflight))
    expect(lockIndex).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('fails closed on pre-existing inconsistent rows in both directions', () => {
    const sql = readMigration()
    const preflight = getPreflight(sql)
    const constraintIndex = sql.indexOf(
      'ADD CONSTRAINT catchup_sessions_status_completed_at_consistency'
    )

    // completed session missing its completion timestamp
    expect(preflight).toMatch(/status\s*=\s*'completed'\s+AND\s+completed_at\s+IS\s+NULL/i)
    // non-completed session that still carries a completion timestamp
    expect(preflight).toMatch(/status\s*<>\s*'completed'\s+AND\s+completed_at\s+IS\s+NOT\s+NULL/i)
    expect(sql.indexOf(preflight)).toBeLessThan(constraintIndex)
  })

  it('raises only a count and does not expose row identifiers', () => {
    const preflight = getPreflight(readMigration())
    const inconsistentCount = preflight.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+INTO\s+(\w*count\w*)/i
    )?.[1]
    const exception = preflight.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(inconsistentCount).toBeDefined()
    if (inconsistentCount === undefined) {
      throw new Error('Preflight must store its inconsistent row count')
    }

    expect(exception).toMatch(
      new RegExp(`RAISE\\s+EXCEPTION\\s+'%'\\s*,\\s*${inconsistentCount}\\s*;`, 'i')
    )
    expect(exception).not.toMatch(/\b(?:id|user_id|subscription_id)\b|ARRAY_AGG|JSON_AGG|STRING_AGG/i)
  })

  it('adds the named CHECK constraint covering both invalid cases', () => {
    const sql = readMigration()
    const constraint = sql.match(
      /ADD\s+CONSTRAINT\s+catchup_sessions_status_completed_at_consistency\s+CHECK\s*\(([\s\S]*?)\)\s*;/i
    )?.[1]

    expect(constraint).toBeDefined()
    if (constraint === undefined) {
      throw new Error('Migration must add catchup_sessions_status_completed_at_consistency')
    }

    // completed sessions require a non-null completed_at
    expect(constraint).toMatch(/status\s*=\s*'completed'\s+AND\s+completed_at\s+IS\s+NOT\s+NULL/i)
    // active/abandoned sessions require a null completed_at
    expect(constraint).toMatch(/status\s*<>\s*'completed'\s+AND\s+completed_at\s+IS\s+NULL/i)
  })

  it('does not alter RLS policies, indexes, or columns', () => {
    const sql = readMigration()
    expect(sql).not.toMatch(
      /DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY|ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
    expect(sql).not.toMatch(/DROP\s+INDEX|CREATE\s+INDEX/i)
    expect(sql).not.toMatch(/ADD\s+COLUMN|DROP\s+COLUMN|ALTER\s+COLUMN/i)
  })
})