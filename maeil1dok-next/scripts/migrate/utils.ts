import mysql from 'mysql2/promise'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { mysqlConfig, supabaseConfig, BATCH_SIZE } from './config.ts'
import type { UserMapping } from './types.ts'

export async function createMySQLConnection(): Promise<mysql.Pool> {
  return mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
}

export function createSupabaseAdmin(): SupabaseClient {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    throw new Error('Supabase URL and Service Role Key are required')
  }

  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)
}

export async function batchInsert<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  data: T[],
  batchSize: number = BATCH_SIZE
): Promise<void> {
  if (data.length === 0) {
    return
  }

  const totalBatches = Math.ceil(data.length / batchSize)

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize
    const end = Math.min(start + batchSize, data.length)
    const batch = data.slice(start, end)

    const { error } = await client.from(table).insert(batch)

    if (error) {
      throw new Error(
        `Failed to insert batch ${i + 1}/${totalBatches} into ${table}: ${error.message}`
      )
    }

    const cumulativeCount = end
    logProgress(`Inserted into ${table}`, cumulativeCount, data.length)
  }
}

export function logProgress(step: string, current: number, total: number): void {
  const percentage = ((current / total) * 100).toFixed(1)
  console.log(`[${step}] ${current}/${total} (${percentage}%)`)
}

export async function loadUserMapping(client: SupabaseClient): Promise<Map<number, string>> {
  const mapping = new Map<number, string>()

  const { data, error } = await client
    .from('user_mappings')
    .select('django_user_id, supabase_user_id')

  if (error) {
    throw new Error(`Failed to load user mappings: ${error.message}`)
  }

  if (data) {
    for (const record of data) {
      mapping.set(record.django_user_id, record.supabase_user_id)
    }
  }

  return mapping
}

export function mapUserId(mapping: Map<number, string>, djangoUserId: number): string {
  const supabaseUserId = mapping.get(djangoUserId)

  if (!supabaseUserId) {
    throw new Error(`No Supabase UUID found for Django user ID: ${djangoUserId}`)
  }

  return supabaseUserId
}
