import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getTableFlag, isDryRun } from './config.ts'
import { batchInsert, createSupabaseAdmin, loadUserMapping } from './utils.ts'
import type {
  DjangoBibleBookmark,
  DjangoBibleHighlight,
  DjangoCatchupSchedule,
  DjangoCatchupSession,
  DjangoFollow,
  DjangoHasenaRecord,
  DjangoPersonalReadingRecord,
  DjangoPlanSubscription,
  DjangoReflectionNote,
  DjangoUserBibleProgress,
  DjangoUserPlanDisplaySettings,
  DjangoUserReadingPosition,
  DjangoUserReadingSettings,
  DjangoUserVideoIntroProgress,
  UserMapping,
} from './types.ts'

const DATA_DIR = join(import.meta.dirname, 'data')

type StringMap = Record<string, string>

type TargetTable =
  | 'user_reading_settings'
  | 'user_reading_positions'
  | 'plan_subscriptions'
  | 'user_progress'
  | 'user_plan_display_settings'
  | 'user_video_intro_progress'
  | 'hasena_records'
  | 'user_follows'
  | 'user_highlights'
  | 'catchup_sessions'
  | 'catchup_schedules'
  | 'bible_bookmarks'
  | 'reflection_notes'
  | 'personal_reading_records'

interface MappingContext {
  userMapping: Map<number, string>
  scheduleMapping: StringMap
  videoIntroMapping: StringMap
  subscriptionMapping: StringMap
  catchupSessionMapping: StringMap
}

interface LoadResult {
  table: TargetTable
  sourceRows: number
  insertRows: number
  skippedRows: number
}

function readJsonFile<T>(filename: string): T {
  const filePath = join(DATA_DIR, filename)
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

function readOptionalJsonFile<T>(filename: string): T | null {
  const filePath = join(DATA_DIR, filename)
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

function safeMapUserId(userMapping: Map<number, string>, djangoUserId: number): string | null {
  const uuid = userMapping.get(djangoUserId)
  if (!uuid) {
    console.warn(`[WARN] No mapping for Django user ID: ${djangoUserId}, skipping row`)
    return null
  }
  return uuid
}

function mapFromRecord(mapping: StringMap, id: number, label: string): string | null {
  const mappedId = mapping[id.toString()]
  if (!mappedId) {
    console.warn(`[WARN] No mapping for ${label} ID: ${id}, skipping row`)
    return null
  }
  return mappedId
}

function normalizeUserMappingFromFallback(): Map<number, string> {
  const raw = readOptionalJsonFile<UserMapping[] | Record<string, string>>('user_mapping.json')
  const mapping = new Map<number, string>()

  if (!raw) {
    return mapping
  }

  if (Array.isArray(raw)) {
    for (const row of raw) {
      mapping.set(row.django_user_id, row.supabase_user_id)
    }
    return mapping
  }

  for (const [key, value] of Object.entries(raw)) {
    const djangoId = Number.parseInt(key, 10)
    if (!Number.isNaN(djangoId)) {
      mapping.set(djangoId, value)
    }
  }

  return mapping
}

async function loadAllMappings(): Promise<MappingContext> {
  const supabase = createSupabaseAdmin()
  let userMapping: Map<number, string>

  try {
    userMapping = await loadUserMapping(supabase)
  } catch (error) {
    console.warn(
      `[WARN] Failed to load mapping from migration_user_mapping: ${error instanceof Error ? error.message : String(error)}`
    )
    userMapping = new Map<number, string>()
  }

  if (userMapping.size === 0) {
    const fallback = normalizeUserMappingFromFallback()
    if (fallback.size === 0) {
      throw new Error('User mapping is empty in Supabase and fallback data/user_mapping.json is missing/empty')
    }
    userMapping = fallback
    console.log(`[INFO] Loaded user mapping from fallback JSON: ${userMapping.size} rows`)
  } else {
    console.log(`[INFO] Loaded user mapping from Supabase: ${userMapping.size} rows`)
  }

  const scheduleMapping = readJsonFile<StringMap>('schedule_id_mapping.json')
  const videoIntroMapping = readJsonFile<StringMap>('video_intro_id_mapping.json')
  const subscriptionMapping = readOptionalJsonFile<StringMap>('subscription_id_mapping.json') ?? {}
  const catchupSessionMapping = readOptionalJsonFile<StringMap>('catchup_session_id_mapping.json') ?? {}

  return {
    userMapping,
    scheduleMapping,
    videoIntroMapping,
    subscriptionMapping,
    catchupSessionMapping,
  }
}

function saveMappingFile(filename: string, mapping: StringMap): void {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(mapping, null, 2))
}

async function insertRows(
  table: TargetTable,
  rows: Array<Record<string, unknown>>,
  sourceRows: number,
  skippedRows: number
): Promise<LoadResult> {
  if (isDryRun) {
    console.log(`[DRY RUN] ${table}: would insert ${rows.length} rows (source=${sourceRows}, skipped=${skippedRows})`)
    return {
      table,
      sourceRows,
      insertRows: rows.length,
      skippedRows,
    }
  }

  const supabase = createSupabaseAdmin()
  await batchInsert(supabase, table, rows, 1000)
  console.log(`[DONE] ${table}: inserted ${rows.length} rows (source=${sourceRows}, skipped=${skippedRows})`)

  return {
    table,
    sourceRows,
    insertRows: rows.length,
    skippedRows,
  }
}

async function loadUserReadingSettings(ctx: MappingContext): Promise<LoadResult> {
  type Source = DjangoUserReadingSettings & {
    font_size?: number
    font_weight?: string
    line_height?: number
    text_align?: string
    verse_joining?: boolean
    show_verse_numbers?: boolean
    show_description?: boolean
    show_cross_ref?: boolean
    highlight_names?: boolean
    show_footnotes?: boolean
    tongdok_auto_complete?: boolean
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('user_reading_settings.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      theme: row.theme,
      font_family: row.font_family,
      font_size: typeof row.font_size === 'number' ? row.font_size : 16,
      font_weight: row.font_weight ?? 'medium',
      line_height: row.line_height ?? 1.6,
      text_align: row.text_align ?? 'left',
      verse_joining: row.verse_joining ?? false,
      show_verse_numbers: row.show_verse_numbers ?? true,
      show_description: row.show_description ?? true,
      show_cross_ref: row.show_cross_ref ?? true,
      highlight_names: row.highlight_names ?? true,
      show_footnotes: row.show_footnotes ?? false,
      tongdok_auto_complete: row.tongdok_auto_complete ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_reading_settings', rows, sourceRows.length, skippedRows)
}

async function loadUserReadingPositions(ctx: MappingContext): Promise<LoadResult> {
  type Source = DjangoUserReadingPosition & {
    verse?: number | null
    scroll_position?: number
    version?: string
  }

  const sourceRows = readJsonFile<Source[]>('user_reading_positions.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse ?? null,
      scroll_position: row.scroll_position ?? 0,
      version: row.version ?? 'GAE',
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_reading_positions', rows, sourceRows.length, skippedRows)
}

async function loadPlanSubscriptions(ctx: MappingContext): Promise<LoadResult> {
  type Source = DjangoPlanSubscription & {
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('plan_subscriptions.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    const subscriptionUuid = randomUUID()
    ctx.subscriptionMapping[row.id.toString()] = subscriptionUuid

    rows.push({
      id: subscriptionUuid,
      user_id: userId,
      plan_id: row.plan_id,
      start_date: row.start_date,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  if (!isDryRun) {
    saveMappingFile('subscription_id_mapping.json', ctx.subscriptionMapping)
  }

  return insertRows('plan_subscriptions', rows, sourceRows.length, skippedRows)
}

function ensureSubscriptionMapping(ctx: MappingContext): void {
  if (Object.keys(ctx.subscriptionMapping).length > 0) {
    return
  }

  const mappingFromFile = readOptionalJsonFile<StringMap>('subscription_id_mapping.json')
  if (!mappingFromFile || Object.keys(mappingFromFile).length === 0) {
    throw new Error(
      'subscription_id_mapping.json not found or empty. Run plan_subscriptions first or run full 03b script.'
    )
  }

  ctx.subscriptionMapping = mappingFromFile
}

async function loadUserProgress(ctx: MappingContext): Promise<LoadResult> {
  ensureSubscriptionMapping(ctx)

  type Source = DjangoUserBibleProgress & {
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('user_progress.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const subscriptionId = mapFromRecord(ctx.subscriptionMapping, row.subscription_id, 'subscription')
    const scheduleId = mapFromRecord(ctx.scheduleMapping, row.schedule_id, 'schedule')

    if (!subscriptionId || !scheduleId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      subscription_id: subscriptionId,
      schedule_id: scheduleId,
      is_completed: row.is_completed,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_progress', rows, sourceRows.length, skippedRows)
}

async function loadUserPlanDisplaySettings(ctx: MappingContext): Promise<LoadResult> {
  ensureSubscriptionMapping(ctx)

  type Source = DjangoUserPlanDisplaySettings & {
    color?: string
    is_visible?: boolean
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('user_plan_display_settings.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    const subscriptionId = mapFromRecord(ctx.subscriptionMapping, row.subscription_id, 'subscription')

    if (!userId || !subscriptionId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      subscription_id: subscriptionId,
      color: row.color ?? '#3B82F6',
      display_order: row.display_order,
      is_visible: row.is_visible ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_plan_display_settings', rows, sourceRows.length, skippedRows)
}

async function loadUserVideoIntroProgress(ctx: MappingContext): Promise<LoadResult> {
  type Source = DjangoUserVideoIntroProgress & {
    is_completed?: boolean
    is_watched?: boolean
    completed_at?: string | null
    watched_at?: string | null
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('user_video_intro_progress.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    const videoIntroId = mapFromRecord(ctx.videoIntroMapping, row.video_intro_id, 'video_intro')

    if (!userId || !videoIntroId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      video_intro_id: videoIntroId,
      is_completed: row.is_completed ?? row.is_watched ?? false,
      completed_at: row.completed_at ?? row.watched_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_video_intro_progress', rows, sourceRows.length, skippedRows)
}

async function loadHasenaRecords(ctx: MappingContext): Promise<LoadResult> {
  type Source = DjangoHasenaRecord & {
    is_completed?: boolean
    watched?: boolean
    created_at?: string
    updated_at?: string
  }

  const sourceRows = readJsonFile<Source[]>('hasena_records.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      date: row.date,
      is_completed: row.is_completed ?? row.watched ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('hasena_records', rows, sourceRows.length, skippedRows)
}

async function loadUserFollows(ctx: MappingContext): Promise<LoadResult> {
  const sourceRows = readJsonFile<DjangoFollow[]>('follows.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const followerId = safeMapUserId(ctx.userMapping, row.follower_id)
    const followingId = safeMapUserId(ctx.userMapping, row.following_id)

    if (!followerId || !followingId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      follower_id: followerId,
      following_id: followingId,
      created_at: row.created_at,
    })
  }

  return insertRows('user_follows', rows, sourceRows.length, skippedRows)
}

async function loadUserHighlights(ctx: MappingContext): Promise<LoadResult> {
  const sourceRows = readJsonFile<DjangoBibleHighlight[]>('bible_highlights.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      book: row.book,
      chapter: row.chapter,
      verse_start: row.start_verse,
      verse_end: row.end_verse,
      color: row.color,
      version: 'GAE',
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('user_highlights', rows, sourceRows.length, skippedRows)
}

async function loadCatchupSessions(ctx: MappingContext): Promise<LoadResult> {
  ensureSubscriptionMapping(ctx)

  const sourceRows = readJsonFile<DjangoCatchupSession[]>('catchup_sessions.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const subscriptionId = mapFromRecord(ctx.subscriptionMapping, row.subscription_id, 'subscription')
    if (!subscriptionId) {
      skippedRows += 1
      continue
    }

    const sessionId = randomUUID()
    ctx.catchupSessionMapping[row.id.toString()] = sessionId

    const sourceRow = row as DjangoCatchupSession & {
      name?: string
      range_start?: string
      range_end?: string
      target_rejoin_date?: string | null
      max_daily_readings?: number | null
      max_daily_chapters?: number | null
      weekend_multiplier?: number
      status?: string
      updated_at?: string
    }

    rows.push({
      id: sessionId,
      subscription_id: subscriptionId,
      name: sourceRow.name ?? `Catchup ${row.id}`,
      range_start: sourceRow.range_start ?? row.target_date ?? row.target_date,
      range_end: sourceRow.range_end ?? row.target_date ?? row.target_date,
      strategy: row.strategy,
      target_rejoin_date: sourceRow.target_rejoin_date ?? row.target_date,
      max_daily_readings: sourceRow.max_daily_readings ?? null,
      max_daily_chapters: sourceRow.max_daily_chapters ?? null,
      weekend_multiplier: sourceRow.weekend_multiplier ?? 1.0,
      status: sourceRow.status ?? (row.completed_at ? 'completed' : 'active'),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: sourceRow.updated_at ?? row.created_at,
    })
  }

  if (!isDryRun) {
    saveMappingFile('catchup_session_id_mapping.json', ctx.catchupSessionMapping)
  }

  return insertRows('catchup_sessions', rows, sourceRows.length, skippedRows)
}

function ensureCatchupSessionMapping(ctx: MappingContext): void {
  if (Object.keys(ctx.catchupSessionMapping).length > 0) {
    return
  }

  const mappingFromFile = readOptionalJsonFile<StringMap>('catchup_session_id_mapping.json')
  if (!mappingFromFile || Object.keys(mappingFromFile).length === 0) {
    throw new Error(
      'catchup_session_id_mapping.json not found or empty. Run catchup_sessions first or run full 03b script.'
    )
  }

  ctx.catchupSessionMapping = mappingFromFile
}

async function loadCatchupSchedules(ctx: MappingContext): Promise<LoadResult> {
  ensureCatchupSessionMapping(ctx)

  const sourceRows = readJsonFile<DjangoCatchupSchedule[]>('catchup_schedules.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const sourceRow = row as DjangoCatchupSchedule & {
      scheduled_date?: string
      is_completed?: boolean
      completed_at?: string | null
      created_at?: string
      updated_at?: string
    }

    const sessionId = mapFromRecord(ctx.catchupSessionMapping, row.session_id, 'catchup_session')
    if (!sessionId) {
      skippedRows += 1
      continue
    }

    const originalScheduleId = mapFromRecord(
      ctx.scheduleMapping,
      row.original_schedule_id,
      'original_schedule'
    )
    if (!originalScheduleId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      session_id: sessionId,
      original_schedule_id: originalScheduleId,
      scheduled_date: sourceRow.scheduled_date,
      is_completed: sourceRow.is_completed ?? false,
      completed_at: sourceRow.completed_at ?? null,
      created_at: sourceRow.created_at,
      updated_at: sourceRow.updated_at,
    })
  }

  return insertRows('catchup_schedules', rows, sourceRows.length, skippedRows)
}

async function loadBibleBookmarks(ctx: MappingContext): Promise<LoadResult> {
  const sourceRows = readJsonFile<DjangoBibleBookmark[]>('bible_bookmarks.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      bookmark_type: row.bookmark_type,
      book: row.book,
      chapter: row.chapter,
      start_verse: row.start_verse,
      end_verse: row.end_verse,
      title: row.title,
      color: row.color,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('bible_bookmarks', rows, sourceRows.length, skippedRows)
}

async function loadReflectionNotes(ctx: MappingContext): Promise<LoadResult> {
  const sourceRows = readJsonFile<DjangoReflectionNote[]>('reflection_notes.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      book: row.book,
      chapter: row.chapter,
      start_verse: row.start_verse,
      end_verse: row.end_verse,
      content: row.content,
      is_private: row.is_private,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return insertRows('reflection_notes', rows, sourceRows.length, skippedRows)
}

async function loadPersonalReadingRecords(ctx: MappingContext): Promise<LoadResult> {
  const sourceRows = readJsonFile<DjangoPersonalReadingRecord[]>('personal_reading_records.json')
  const rows: Array<Record<string, unknown>> = []
  let skippedRows = 0

  for (const row of sourceRows) {
    const userId = safeMapUserId(ctx.userMapping, row.user_id)
    if (!userId) {
      skippedRows += 1
      continue
    }

    rows.push({
      id: randomUUID(),
      user_id: userId,
      book: row.book,
      chapter: row.chapter,
      read_date: row.read_date,
      created_at: row.created_at,
    })
  }

  return insertRows('personal_reading_records', rows, sourceRows.length, skippedRows)
}

const TABLE_LOADERS: Array<{ table: TargetTable; run: (ctx: MappingContext) => Promise<LoadResult> }> = [
  { table: 'user_reading_settings', run: loadUserReadingSettings },
  { table: 'user_reading_positions', run: loadUserReadingPositions },
  { table: 'plan_subscriptions', run: loadPlanSubscriptions },
  { table: 'user_progress', run: loadUserProgress },
  { table: 'user_plan_display_settings', run: loadUserPlanDisplaySettings },
  { table: 'user_video_intro_progress', run: loadUserVideoIntroProgress },
  { table: 'hasena_records', run: loadHasenaRecords },
  { table: 'user_follows', run: loadUserFollows },
  { table: 'user_highlights', run: loadUserHighlights },
  { table: 'catchup_sessions', run: loadCatchupSessions },
  { table: 'catchup_schedules', run: loadCatchupSchedules },
  { table: 'bible_bookmarks', run: loadBibleBookmarks },
  { table: 'reflection_notes', run: loadReflectionNotes },
  { table: 'personal_reading_records', run: loadPersonalReadingRecords },
]

function getTablesToRun(tableFlag: string | null): Array<{ table: TargetTable; run: (ctx: MappingContext) => Promise<LoadResult> }> {
  if (!tableFlag) {
    return TABLE_LOADERS
  }

  const matched = TABLE_LOADERS.filter((config) => config.table === tableFlag)
  if (matched.length === 0) {
    const available = TABLE_LOADERS.map((config) => config.table).join(', ')
    throw new Error(`Unknown table: ${tableFlag}. Available tables: ${available}`)
  }

  return matched
}

async function main(): Promise<void> {
  const tableFlag = getTableFlag()
  const ctx = await loadAllMappings()
  const tablesToRun = getTablesToRun(tableFlag)

  console.log(`[START] 03b user-data loader (dry-run=${isDryRun}, table=${tableFlag ?? 'all'})`)

  const results: LoadResult[] = []
  for (const config of tablesToRun) {
    results.push(await config.run(ctx))
  }

  console.log('\n--- User Data Load Summary ---')
  for (const result of results) {
    console.log(
      `${result.table}: source=${result.sourceRows}, inserted=${result.insertRows}, skipped=${result.skippedRows}`
    )
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
