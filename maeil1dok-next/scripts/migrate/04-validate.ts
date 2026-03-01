import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createSupabaseAdmin } from './utils.ts'
import type { UserMapping, ExtractionSummary, DjangoUser } from './types.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountCheck {
  table: string
  djangoCount: number
  supabaseCount: number
  status: 'pass' | 'fail' | 'warn'
  note?: string
}

interface FKCheck {
  description: string
  query: string
  status: 'pass' | 'fail'
  orphanCount?: number
}

interface SpotCheck {
  userId: string
  nickname: string | null
  progressCount: number
  hasSettings: boolean
}

interface UniqueCheck {
  table: string
  status: 'pass' | 'fail'
  duplicateCount: number
}

interface ValidationReport {
  timestamp: string
  overall: 'pass' | 'fail'
  countChecks: CountCheck[]
  fkChecks: FKCheck[]
  userMappingCheck: {
    status: 'pass' | 'fail'
    djangoActiveUsers: number
    mappedUsers: number
  }
  spotChecks: SpotCheck[]
  uniqueChecks: UniqueCheck[]
  summary: { passed: number; failed: number; warned: number }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATA_DIR = join(import.meta.dirname, 'data')

function loadJSON<T>(filename: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf-8')) as T
}

function heading(title: string): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

function statusIcon(s: 'pass' | 'fail' | 'warn'): string {
  if (s === 'pass') return '✅'
  if (s === 'warn') return '⚠️'
  return '❌'
}

// ---------------------------------------------------------------------------
// 1. Row Count Comparison
// ---------------------------------------------------------------------------

/** Map extraction_summary keys → Supabase table names */
const COUNT_MAP: Record<string, string> = {
  users: 'profiles',
  bible_reading_plans: 'bible_reading_plans',
  plan_subscriptions: 'plan_subscriptions',
  daily_schedules: 'daily_schedules',
  user_progress: 'user_progress',
  video_bible_intros: 'video_bible_intros',
  user_video_intro_progress: 'user_video_intro_progress',
  hasena_records: 'hasena_records',
  hasena_summaries: 'hasena_summaries',
  catchup_sessions: 'catchup_sessions',
  catchup_schedules: 'catchup_schedules',
  user_plan_display_settings: 'user_plan_display_settings',
  user_reading_positions: 'user_reading_positions',
  user_reading_settings: 'user_reading_settings',
  follows: 'user_follows',
  bible_highlights: 'user_highlights',
  bible_bookmarks: 'bible_bookmarks',
  reflection_notes: 'reflection_notes',
  personal_reading_records: 'personal_reading_records',
}

/** Skip these extraction keys — they share a Supabase table already counted */
const SKIP_KEYS = new Set(['user_profiles', 'social_accounts'])

async function runCountChecks(): Promise<CountCheck[]> {
  heading('1. Row Count Comparison')
  const supabase = createSupabaseAdmin()
  const summary = loadJSON<Record<string, number | string>>('extraction_summary.json')

  const checks: CountCheck[] = []

  for (const [extractionKey, supabaseTable] of Object.entries(COUNT_MAP)) {
    const djangoCount = typeof summary[extractionKey] === 'number'
      ? (summary[extractionKey] as number)
      : 0

    const { count, error } = await supabase
      .from(supabaseTable)
      .select('*', { count: 'exact', head: true })

    if (error) {
      checks.push({
        table: supabaseTable,
        djangoCount,
        supabaseCount: 0,
        status: 'fail',
        note: `Query error: ${error.message}`,
      })
      continue
    }

    const supabaseCount = count ?? 0
    const diff = djangoCount - supabaseCount
    const diffPct = djangoCount > 0 ? (diff / djangoCount) * 100 : 0

    let status: CountCheck['status'] = 'pass'
    let note: string | undefined

    if (supabaseCount === djangoCount) {
      status = 'pass'
    } else if (supabaseCount < djangoCount && diffPct <= 5) {
      status = 'warn'
      note = `Supabase has ${diff} fewer rows (${diffPct.toFixed(1)}%) — likely skipped deleted/merged users`
    } else if (supabaseCount < djangoCount) {
      status = 'fail'
      note = `Supabase has ${diff} fewer rows (${diffPct.toFixed(1)}%) — exceeds 5% threshold`
    } else {
      // supabaseCount > djangoCount — unexpected
      status = 'fail'
      note = `Supabase has ${supabaseCount - djangoCount} MORE rows than Django`
    }

    checks.push({ table: supabaseTable, djangoCount, supabaseCount, status, note })
    console.log(
      `  ${statusIcon(status)} ${supabaseTable.padEnd(32)} Django: ${String(djangoCount).padStart(7)}  Supabase: ${String(supabaseCount).padStart(7)}${note ? `  (${note})` : ''}`
    )
  }

  return checks
}

// ---------------------------------------------------------------------------
// 2. FK Integrity Checks
// ---------------------------------------------------------------------------

interface FKCheckDef {
  description: string
  childTable: string
  childColumn: string
  parentTable: string
  parentColumn: string
}

const FK_DEFS: FKCheckDef[] = [
  {
    description: 'user_progress.subscription_id → plan_subscriptions.id',
    childTable: 'user_progress',
    childColumn: 'subscription_id',
    parentTable: 'plan_subscriptions',
    parentColumn: 'id',
  },
  {
    description: 'user_progress.schedule_id → daily_schedules.id',
    childTable: 'user_progress',
    childColumn: 'schedule_id',
    parentTable: 'daily_schedules',
    parentColumn: 'id',
  },
  {
    description: 'plan_subscriptions.user_id → profiles.user_id',
    childTable: 'plan_subscriptions',
    childColumn: 'user_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'catchup_sessions.subscription_id → plan_subscriptions.id',
    childTable: 'catchup_sessions',
    childColumn: 'subscription_id',
    parentTable: 'plan_subscriptions',
    parentColumn: 'id',
  },
  {
    description: 'catchup_schedules.session_id → catchup_sessions.id',
    childTable: 'catchup_schedules',
    childColumn: 'session_id',
    parentTable: 'catchup_sessions',
    parentColumn: 'id',
  },
  {
    description: 'catchup_schedules.original_schedule_id → daily_schedules.id',
    childTable: 'catchup_schedules',
    childColumn: 'original_schedule_id',
    parentTable: 'daily_schedules',
    parentColumn: 'id',
  },
  {
    description: 'user_follows.follower_id → profiles.user_id',
    childTable: 'user_follows',
    childColumn: 'follower_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'user_follows.following_id → profiles.user_id',
    childTable: 'user_follows',
    childColumn: 'following_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'user_highlights.user_id → profiles.user_id',
    childTable: 'user_highlights',
    childColumn: 'user_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'bible_bookmarks.user_id → profiles.user_id',
    childTable: 'bible_bookmarks',
    childColumn: 'user_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'reflection_notes.user_id → profiles.user_id',
    childTable: 'reflection_notes',
    childColumn: 'user_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
  {
    description: 'personal_reading_records.user_id → profiles.user_id',
    childTable: 'personal_reading_records',
    childColumn: 'user_id',
    parentTable: 'profiles',
    parentColumn: 'user_id',
  },
]

async function runFKChecks(): Promise<FKCheck[]> {
  heading('2. FK Integrity Checks')
  const supabase = createSupabaseAdmin()
  const checks: FKCheck[] = []

  for (const def of FK_DEFS) {
    // Fetch all distinct FK values from child table
    const PAGE = 1000
    const childIds = new Set<string>()
    let offset = 0
    let done = false
    while (!done) {
      const { data, error } = await supabase
        .from(def.childTable)
        .select(def.childColumn)
        .range(offset, offset + PAGE - 1)

      if (error) {
        checks.push({
          description: def.description,
          query: `SELECT DISTINCT ${def.childColumn} FROM ${def.childTable}`,
          status: 'fail',
          orphanCount: -1,
        })
        console.log(`  ❌ ${def.description} — query error: ${error.message}`)
        done = true
        continue
      }

      if (!data || data.length === 0) {
        done = true
        continue
      }

      for (const row of data) {
        const val = (row as unknown as Record<string, unknown>)[def.childColumn]
        if (val != null) childIds.add(String(val))
      }

      if (data.length < PAGE) {
        done = true
      } else {
        offset += PAGE
      }
    }

    if (childIds.size === 0) {
      checks.push({
        description: def.description,
        query: `No child rows in ${def.childTable}`,
        status: 'pass',
        orphanCount: 0,
      })
      console.log(`  ✅ ${def.description} — no child rows (trivially valid)`)
      continue
    }

    // Fetch all parent IDs
    const parentIds = new Set<string>()
    offset = 0
    done = false
    while (!done) {
      const { data, error } = await supabase
        .from(def.parentTable)
        .select(def.parentColumn)
        .range(offset, offset + PAGE - 1)

      if (error) {
        checks.push({
          description: def.description,
          query: `SELECT ${def.parentColumn} FROM ${def.parentTable}`,
          status: 'fail',
          orphanCount: -1,
        })
        console.log(`  ❌ ${def.description} — parent query error: ${error.message}`)
        done = true
        continue
      }

      if (!data || data.length === 0) {
        done = true
        continue
      }

      for (const row of data) {
        const val = (row as unknown as Record<string, unknown>)[def.parentColumn]
        if (val != null) parentIds.add(String(val))
      }

      if (data.length < PAGE) {
        done = true
      } else {
        offset += PAGE
      }
    }

    // Count orphans: child IDs not in parent set
    let orphanCount = 0
    for (const cid of childIds) {
      if (!parentIds.has(cid)) orphanCount++
    }

    const status: FKCheck['status'] = orphanCount > 0 ? 'fail' : 'pass'
    checks.push({
      description: def.description,
      query: `DISTINCT ${def.childColumn} from ${def.childTable} NOT IN ${def.parentTable}.${def.parentColumn}`,
      status,
      orphanCount,
    })
    console.log(
      `  ${statusIcon(status)} ${def.description} — ${orphanCount} orphan(s)`
    )
  }

  return checks
}

// ---------------------------------------------------------------------------
// 3. User Mapping Completeness
// ---------------------------------------------------------------------------

async function runUserMappingCheck(): Promise<ValidationReport['userMappingCheck']> {
  heading('3. User Mapping Completeness')

  const users = loadJSON<DjangoUser[]>('users.json')
  const mapping = loadJSON<UserMapping[]>('user_mapping.json')

  // Active = not deleted (no scheduled_deletion_at) and not merged
  const activeUsers = users.filter(
    u => u.is_active && !u.scheduled_deletion_at && !u.merged_into_id
  )

  const djangoActiveUsers = activeUsers.length
  const mappedUsers = mapping.length

  const status: 'pass' | 'fail' = mappedUsers >= djangoActiveUsers ? 'pass' : 'fail'

  console.log(`  Active Django users:  ${djangoActiveUsers}`)
  console.log(`  Mapped to Supabase:   ${mappedUsers}`)
  console.log(`  ${statusIcon(status)} ${status === 'pass' ? 'All active users mapped' : `Missing ${djangoActiveUsers - mappedUsers} mapping(s)`}`)

  return { status, djangoActiveUsers, mappedUsers }
}

// ---------------------------------------------------------------------------
// 4. Data Spot-Check
// ---------------------------------------------------------------------------

async function runSpotChecks(): Promise<SpotCheck[]> {
  heading('4. Data Spot-Check (5 random users)')
  const supabase = createSupabaseAdmin()
  const mapping = loadJSON<UserMapping[]>('user_mapping.json')

  // Pick 5 random users
  const shuffled = [...mapping].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, Math.min(5, shuffled.length))

  const results: SpotCheck[] = []

  for (const m of sample) {
    const userId = m.supabase_user_id

    // Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('user_id', userId)
      .single()

    // Progress count
    const { count: progressCount } = await supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_id', userId) // indirect — we need to go through subscriptions

    // Actually, user_progress doesn't have user_id directly.
    // Count via plan_subscriptions join:
    const { data: subs } = await supabase
      .from('plan_subscriptions')
      .select('id')
      .eq('user_id', userId)

    let totalProgress = 0
    if (subs && subs.length > 0) {
      const subIds = subs.map(s => s.id)
      const { count } = await supabase
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .in('subscription_id', subIds)
      totalProgress = count ?? 0
    }

    // Reading settings
    const { data: settings } = await supabase
      .from('user_reading_settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    const spotCheck: SpotCheck = {
      userId,
      nickname: profile?.nickname ?? null,
      progressCount: totalProgress,
      hasSettings: !!settings,
    }
    results.push(spotCheck)

    console.log(
      `  👤 ${userId.slice(0, 8)}…  nickname=${spotCheck.nickname ?? '(null)'}  progress=${spotCheck.progressCount}  settings=${spotCheck.hasSettings}`
    )
  }

  return results
}

// ---------------------------------------------------------------------------
// 5. Unique Constraint Validation
// ---------------------------------------------------------------------------

async function runUniqueChecks(): Promise<UniqueCheck[]> {
  heading('5. Unique Constraint Validation')
  const supabase = createSupabaseAdmin()
  const checks: UniqueCheck[] = []

  // personal_reading_records: UNIQUE(user_id, book, chapter)
  {
    const PAGE = 1000
    const seen = new Map<string, number>()
    let offset = 0
    let done = false

    while (!done) {
      const { data, error } = await supabase
        .from('personal_reading_records')
        .select('user_id, book, chapter')
        .range(offset, offset + PAGE - 1)

      if (error) {
        checks.push({ table: 'personal_reading_records', status: 'fail', duplicateCount: -1 })
        console.log(`  ❌ personal_reading_records — query error: ${error.message}`)
        done = true
        continue
      }

      if (!data || data.length === 0) {
        done = true
        continue
      }

      for (const row of data) {
        const key = `${row.user_id}|${row.book}|${row.chapter}`
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }

      if (data.length < PAGE) {
        done = true
      } else {
        offset += PAGE
      }
    }

    let duplicateCount = 0
    for (const count of seen.values()) {
      if (count > 1) duplicateCount++
    }

    const status: UniqueCheck['status'] = duplicateCount > 0 ? 'fail' : 'pass'
    checks.push({ table: 'personal_reading_records', status, duplicateCount })
    console.log(`  ${statusIcon(status)} personal_reading_records (user_id, book, chapter) — ${duplicateCount} duplicate group(s)`)
  }

  // plan_subscriptions: UNIQUE(user_id, plan_id)
  {
    const PAGE = 1000
    const seen = new Map<string, number>()
    let offset = 0
    let done = false

    while (!done) {
      const { data, error } = await supabase
        .from('plan_subscriptions')
        .select('user_id, plan_id')
        .range(offset, offset + PAGE - 1)

      if (error) {
        checks.push({ table: 'plan_subscriptions', status: 'fail', duplicateCount: -1 })
        console.log(`  ❌ plan_subscriptions — query error: ${error.message}`)
        done = true
        continue
      }

      if (!data || data.length === 0) {
        done = true
        continue
      }

      for (const row of data) {
        const key = `${row.user_id}|${row.plan_id}`
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }

      if (data.length < PAGE) {
        done = true
      } else {
        offset += PAGE
      }
    }

    let duplicateCount = 0
    for (const count of seen.values()) {
      if (count > 1) duplicateCount++
    }

    const status: UniqueCheck['status'] = duplicateCount > 0 ? 'fail' : 'pass'
    checks.push({ table: 'plan_subscriptions', status, duplicateCount })
    console.log(`  ${statusIcon(status)} plan_subscriptions (user_id, plan_id) — ${duplicateCount} duplicate group(s)`)
  }

  return checks
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║        Post-Migration Validation (read-only)           ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  const countChecks = await runCountChecks()
  const fkChecks = await runFKChecks()
  const userMappingCheck = await runUserMappingCheck()
  const spotChecks = await runSpotChecks()
  const uniqueChecks = await runUniqueChecks()

  // Tally results
  let passed = 0
  let failed = 0
  let warned = 0

  for (const c of countChecks) {
    if (c.status === 'pass') passed++
    else if (c.status === 'warn') warned++
    else failed++
  }
  for (const c of fkChecks) {
    if (c.status === 'pass') passed++
    else failed++
  }
  if (userMappingCheck.status === 'pass') passed++
  else failed++
  for (const c of uniqueChecks) {
    if (c.status === 'pass') passed++
    else failed++
  }

  const overall: ValidationReport['overall'] = failed > 0 ? 'fail' : 'pass'

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    overall,
    countChecks,
    fkChecks,
    userMappingCheck,
    spotChecks,
    uniqueChecks,
    summary: { passed, failed, warned },
  }

  // Write report
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(
    join(DATA_DIR, 'validation_report.json'),
    JSON.stringify(report, null, 2)
  )

  // Print summary
  heading('Summary')
  console.log(`  Passed:  ${passed}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Warned:  ${warned}`)
  console.log(`  Overall: ${statusIcon(overall)} ${overall.toUpperCase()}`)
  console.log(`\n  Report saved to: data/validation_report.json`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Validation failed with error:', err)
  process.exit(1)
})
