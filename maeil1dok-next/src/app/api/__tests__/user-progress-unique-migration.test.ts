import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000700_user_progress_unique_subscription_schedule.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

function getDuplicatePreflight(sql: string): string {
  const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
  const duplicatePreflight = doBlocks.find((block) =>
    /FROM\s+public\.user_progress/i.test(block)
  )

  if (duplicatePreflight === undefined) {
    throw new Error('Migration must preflight duplicate user progress rows')
  }

  return duplicatePreflight
}

describe('user_progress one row per subscription schedule migration', () => {
  it('locks progress rows before duplicate detection so concurrent writes cannot bypass the preflight', () => {
    const sql = readMigration()
    const duplicatePreflight = getDuplicatePreflight(sql)
    const tableLock = sql.match(
      /LOCK\s+TABLE\s+public\.user_progress\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE\s*;/i
    )?.[0]

    expect(tableLock).toBeDefined()
    expect(sql.indexOf(tableLock ?? '')).toBeLessThan(
      sql.indexOf(duplicatePreflight)
    )
  })

  it('fails before adding the constraint when duplicate subscription schedule pairs exist', () => {
    const duplicatePreflight = getDuplicatePreflight(readMigration())

    expect(duplicatePreflight).toMatch(/FROM\s+public\.user_progress/i)
    expect(duplicatePreflight).toMatch(
      /GROUP\s+BY\s+subscription_id\s*,\s*schedule_id/i
    )
    expect(duplicatePreflight).toMatch(/HAVING\s+COUNT\s*\(\s*\*\s*\)\s*>\s*1/i)
  })

  it('raises only the duplicate group count without exposing progress identifiers', () => {
    const duplicatePreflight = getDuplicatePreflight(readMigration())
    const duplicateCount = duplicatePreflight.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+INTO\s+(\w*count\w*)/i
    )?.[1]
    const exception = duplicatePreflight.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(duplicateCount).toBeDefined()
    if (duplicateCount === undefined) {
      throw new Error('Duplicate preflight must store its duplicate group count')
    }

    expect(exception).toMatch(
      new RegExp(`RAISE\\s+EXCEPTION\\s+'%'\\s*,\\s*${duplicateCount}\\s*;`, 'i')
    )
    expect(exception).not.toMatch(
      /\b(?:id|user_id|subscription_id|schedule_id)\b|ARRAY_AGG|JSON_AGG|STRING_AGG/i
    )
  })

  it('adds the unique constraint after the duplicate preflight without changing RLS', () => {
    const sql = readMigration()
    const duplicatePreflight = getDuplicatePreflight(sql)
    const uniqueConstraint = sql.match(
      /ALTER\s+TABLE\s+public\.user_progress\s+ADD\s+CONSTRAINT\s+user_progress_subscription_schedule_key\s+UNIQUE\s*\(\s*subscription_id\s*,\s*schedule_id\s*\)/i
    )?.[0]

    expect(uniqueConstraint).toBeDefined()
    expect(sql.indexOf(duplicatePreflight)).toBeLessThan(
      sql.indexOf(uniqueConstraint ?? '')
    )
    expect(sql).not.toMatch(
      /DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY|ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
  })
})
