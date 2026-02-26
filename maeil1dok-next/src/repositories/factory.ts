import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { SupabaseAuthRepository } from './implementations/SupabaseAuthRepository'
import { SupabaseScheduleRepository } from './implementations/SupabaseScheduleRepository'
import { SupabasePlanRepository } from './implementations/SupabasePlanRepository'
import { SupabaseProgressRepository } from './implementations/SupabaseProgressRepository'
import { SupabaseProfileRepository } from './implementations/SupabaseProfileRepository'
import { SupabaseCatchupRepository } from './implementations/SupabaseCatchupRepository'
import { SupabaseHasenaRepository } from './implementations/SupabaseHasenaRepository'
import { SupabaseBibleRepository } from './implementations/SupabaseBibleRepository'
import type { IAuthRepository } from './interfaces/IAuthRepository'
import type { IScheduleRepository } from './interfaces/IScheduleRepository'
import type { IPlanRepository } from './interfaces/IPlanRepository'
import type { IProgressRepository } from './interfaces/IProgressRepository'
import type { IProfileRepository } from './interfaces/IProfileRepository'
import type { ICatchupRepository } from './interfaces/ICatchupRepository'
import type { IHasenaRepository } from './interfaces/IHasenaRepository'
import type { IBibleRepository } from './interfaces/IBibleRepository'

export type TypedSupabaseClient = SupabaseClient<Database>

export interface ServerRepositories {
  auth: IAuthRepository
  schedule: IScheduleRepository
  plan: IPlanRepository
  progress: IProgressRepository
  profile: IProfileRepository
  catchup: ICatchupRepository
  hasena: IHasenaRepository
  bible: IBibleRepository
}

export interface ClientRepositories {
  auth: IAuthRepository
  schedule: IScheduleRepository
  plan: IPlanRepository
  progress: IProgressRepository
  profile: IProfileRepository
  catchup: ICatchupRepository
  hasena: IHasenaRepository
  bible: IBibleRepository
}

/**
 * Creates server-side repositories (for use in Server Components and Route Handlers)
 * @param client - Supabase server client
 */
export function createServerRepositories(client: TypedSupabaseClient): ServerRepositories {
  return {
    auth: new SupabaseAuthRepository(client),
    schedule: new SupabaseScheduleRepository(client),
    plan: new SupabasePlanRepository(client),
    progress: new SupabaseProgressRepository(client),
    profile: new SupabaseProfileRepository(client),
    catchup: new SupabaseCatchupRepository(client),
    hasena: new SupabaseHasenaRepository(client),
    bible: new SupabaseBibleRepository(client),
  }
}

/**
 * Creates client-side repositories (for use in Client Components)
 * @param client - Supabase browser client
 */
export function createClientRepositories(client: TypedSupabaseClient): ClientRepositories {
  return {
    auth: new SupabaseAuthRepository(client),
    schedule: new SupabaseScheduleRepository(client),
    plan: new SupabasePlanRepository(client),
    progress: new SupabaseProgressRepository(client),
    profile: new SupabaseProfileRepository(client),
    catchup: new SupabaseCatchupRepository(client),
    hasena: new SupabaseHasenaRepository(client),
    bible: new SupabaseBibleRepository(client),
  }
}
