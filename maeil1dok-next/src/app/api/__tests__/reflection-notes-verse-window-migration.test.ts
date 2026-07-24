import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711001000_reflection_notes_verse_window_invariant.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

function getPreflight(sql: string): string {
  const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
  const preflight = doBlocks.find((block) => /FROM\s+public\.reflection_notes/i.test(block))

  if (preflight === undefined) {
    throw new Error('Migration must preflight invalid reflection_notes rows')
  }

  return preflight
}

describe('reflection_notes verse-window invariant migration', () => {
  it('locks the table before cleanup, preflight, and constraint work', () => {
    const sql = readMigration()
    const tableLock = sql.match(
      /LOCK\s+TABLE\s+public\.reflection_notes\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE\s*;/i
    )?.[0]
    const preflight = getPreflight(sql)
    const cleanup = sql.match(/UPDATE\s+public\.reflection_notes/i)?.[0]
    const constraint = sql.match(/ADD\s+CONSTRAINT\s+reflection_notes_verse_window_check/i)?.[0]

    expect(tableLock).toBeDefined()
    expect(cleanup).toBeDefined()
    expect(constraint).toBeDefined()

    const lockIndex = sql.indexOf(tableLock ?? '')
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(lockIndex).toBeLessThan(sql.indexOf(cleanup ?? ''))
    expect(lockIndex).toBeLessThan(sql.indexOf(preflight))
    expect(lockIndex).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('normalizes positive one-sided rows in both directions', () => {
    const sql = readMigration()

    const fillEnd = sql.match(
      /UPDATE\s+public\.reflection_notes\s+SET\s+end_verse\s*=\s*start_verse[\s\S]*?;/i
    )?.[0]
    expect(fillEnd).toBeDefined()
    expect(fillEnd).toMatch(/start_verse\s*>\s*0/i)
    expect(fillEnd).toMatch(/end_verse\s+IS\s+NULL/i)

    const fillStart = sql.match(
      /UPDATE\s+public\.reflection_notes\s+SET\s+start_verse\s*=\s*end_verse[\s\S]*?;/i
    )?.[0]
    expect(fillStart).toBeDefined()
    expect(fillStart).toMatch(/end_verse\s*>\s*0/i)
    expect(fillStart).toMatch(/start_verse\s+IS\s+NULL/i)
  })

  it('preflights invalid rows before adding the constraint', () => {
    const sql = readMigration()
    const preflight = getPreflight(sql)
    const constraint = sql.match(/ADD\s+CONSTRAINT\s+reflection_notes_verse_window_check/i)?.[0]

    expect(preflight).toMatch(/chapter\s*<=\s*0/i)
    expect(preflight).toMatch(/start_verse\s+IS\s+NULL/i)
    expect(preflight).toMatch(/end_verse\s+IS\s+NULL/i)
    expect(preflight).toMatch(/start_verse\s*<=\s*0/i)
    expect(preflight).toMatch(/end_verse\s*<=\s*0/i)
    expect(preflight).toMatch(/end_verse\s*<\s*start_verse/i)
    expect(sql.indexOf(preflight)).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('raises only a count and does not expose row identifiers', () => {
    const preflight = getPreflight(readMigration())
    const invalidCount = preflight.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+INTO\s+(\w*count\w*)/i
    )?.[1]
    const exception = preflight.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(invalidCount).toBeDefined()
    if (invalidCount === undefined) {
      throw new Error('Preflight must store its invalid row count')
    }

    expect(exception).toMatch(
      new RegExp(`RAISE\\s+EXCEPTION\\s+'%'\\s*,\\s*${invalidCount}\\s*;`, 'i')
    )
    expect(exception).not.toMatch(/\b(?:id|user_id)\b|ARRAY_AGG|JSON_AGG|STRING_AGG/i)
  })

  it('requires canonical null/null or positive ordered verse windows in the check constraint', () => {
    const sql = readMigration()
    const constraint = sql.match(
      /ADD\s+CONSTRAINT\s+reflection_notes_verse_window_check\s+CHECK\s*\(([\s\S]*?)\)\s*;/i
    )?.[1]

    expect(constraint).toBeDefined()
    if (constraint === undefined) {
      throw new Error('Migration must add reflection_notes_verse_window_check')
    }

    expect(constraint).toMatch(/chapter\s*>\s*0/i)
    expect(constraint).toMatch(/start_verse\s+IS\s+NULL\s+AND\s+end_verse\s+IS\s+NULL/i)
    expect(constraint).toMatch(/start_verse\s+IS\s+NOT\s+NULL/i)
    expect(constraint).toMatch(/end_verse\s+IS\s+NOT\s+NULL/i)
    expect(constraint).toMatch(/start_verse\s*>\s*0/i)
    expect(constraint).toMatch(/end_verse\s*>\s*0/i)
    expect(constraint).toMatch(/end_verse\s*>=\s*start_verse/i)
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
