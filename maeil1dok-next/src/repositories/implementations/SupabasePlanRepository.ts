import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IPlanRepository } from '@/repositories/interfaces/IPlanRepository'
import type { BibleReadingPlan, PlanSubscription, PlanDisplaySettings } from '@/types'
import { NotFoundError, NetworkError, AuthError } from '@/repositories/types/errors'

type DBPlan = Database['public']['Tables']['bible_reading_plans']['Row']
type DBSubscription = Database['public']['Tables']['plan_subscriptions']['Row']
type DBDisplaySettings = Database['public']['Tables']['user_plan_display_settings']['Row']
type SubscriptionInsert = Database['public']['Tables']['plan_subscriptions']['Insert']
type SubscriptionUpdate = Database['public']['Tables']['plan_subscriptions']['Update']
type DisplaySettingsUpdate = Database['public']['Tables']['user_plan_display_settings']['Update']

function mapPlan(row: DBPlan): BibleReadingPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSubscription(row: DBSubscription): PlanSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    startDate: row.start_date,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDisplaySettings(row: DBDisplaySettings): PlanDisplaySettings {
  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    color: row.color,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabasePlanRepository implements IPlanRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error || !user) throw new AuthError('Not authenticated')
    return user.id
  }


  async getAvailablePlans(): Promise<BibleReadingPlan[]> {
    const { data, error } = await this.supabase
      .from('bible_reading_plans')
      .select('*')
      .eq('is_active', true)
      .order('id')
    
    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapPlan)
  }

  async getPlanById(planId: number): Promise<BibleReadingPlan> {
    const { data, error } = await this.supabase
      .from('bible_reading_plans')
      .select('*')
      .eq('id', planId)
      .single()
    
    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NotFoundError(`Plan ${planId} not found`, 'bible_reading_plans')
    return mapPlan(data)
  }

  async subscribeToPlan(planId: number, startDate: string): Promise<PlanSubscription> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) throw new NetworkError('User not authenticated')

    // Authorization/data-integrity: only allow subscribing to a plan that
    // exists AND is active. Mirrors getAvailablePlans()'s is_active filter and
    // the tightened RLS, so inactive/missing plans map to a safe NotFound
    // instead of a generic insert failure. This lookup MUST run before insert.
    const { data: plan, error: planError } = await this.supabase
      .from('bible_reading_plans')
      .select('id')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError) {
      if (planError.code === 'PGRST116') {
        throw new NotFoundError('Plan not found', 'bible_reading_plans')
      }
      throw new NetworkError(planError.message, planError)
    }
    if (!plan) throw new NotFoundError('Plan not found', 'bible_reading_plans')

    // Idempotency + data-integrity: plan_subscriptions has UNIQUE(user_id, plan_id),
    // so a blind insert for a plan the user already has (active OR previously
    // hidden/inactive) would violate the constraint and surface as an unhandled
    // 500. Look up any existing row for this owner+plan first, then:
    //   - active row   -> return as-is (no write, subscribe is a no-op)
    //   - inactive row -> reactivate in place (owner-scoped update, no insert)
    //   - no row       -> insert a fresh subscription
    const { data: existingRow, error: existingError } = await this.supabase
      .from('plan_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_id', planId)
      .maybeSingle()

    if (existingError) throw new NetworkError(existingError.message, existingError)

    const existing = existingRow as DBSubscription | null
    if (existing) {
      if (existing.is_active) return mapSubscription(existing)

      const { data: reactivated, error: reactivateError } = await (this.supabase as any)
        .from('plan_subscriptions')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (reactivateError) throw new NetworkError(reactivateError.message, reactivateError)
      if (!reactivated) throw new NetworkError('Failed to reactivate subscription')
      return mapSubscription(reactivated)
    }

    const { data, error } = await this.supabase
      .from('plan_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: planId,
        start_date: startDate,
      } as any)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to create subscription')
    return mapSubscription(data)
  }

  async unsubscribeFromPlan(subscriptionId: string): Promise<void> {
    // Deny-by-default + object ownership: only the authenticated owner may
    // deactivate their own subscription. Scoping the write by user_id (not id
    // alone) prevents an IDOR where any caller could unsubscribe another user
    // by guessing subscription IDs, instead of relying solely on RLS.
    const userId = await this.getCurrentUserId()
    const { error } = await (this.supabase as any)
      .from('plan_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId)
      .eq('user_id', userId)

    if (error) throw new NetworkError(error.message, error)
  }


  async getUserSubscriptions(): Promise<PlanSubscription[]> {
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    if (authError || !user) throw new NetworkError('User not authenticated')
    
    const { data, error } = await this.supabase
      .from('plan_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSubscription)
  }

  async getSubscriptionById(id: string): Promise<PlanSubscription | null> {
    const { data, error } = await this.supabase
      .from('plan_subscriptions')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapSubscription(data) : null
  }

  async getDisplaySettings(subscriptionId: string): Promise<PlanDisplaySettings | null> {
    const { data, error } = await this.supabase
      .from('user_plan_display_settings')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapDisplaySettings(data) : null
  }

  async getDisplaySettingsForSubscriptions(subscriptionIds: string[]): Promise<PlanDisplaySettings[]> {
    const uniqueIds = [...new Set(subscriptionIds)]
    if (uniqueIds.length === 0) return []

    const { data, error } = await this.supabase
      .from('user_plan_display_settings')
      .select('*')
      .in('subscription_id', uniqueIds)

    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapDisplaySettings)
  }

  async updateDisplaySettings(
    subscriptionId: string,
    data: Partial<Pick<PlanDisplaySettings, 'color' | 'displayOrder' | 'isVisible'>>
  ): Promise<PlanDisplaySettings> {
    // Object ownership: scope the write to the authenticated user's own
    // display-settings row so a subscription_id sweep cannot mutate another
    // user's plan display settings (defense-in-depth beyond RLS).
    const userId = await this.getCurrentUserId()
    const updateData: Record<string, unknown> = {}
    if (data.color !== undefined) updateData.color = data.color
    if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder
    if (data.isVisible !== undefined) updateData.is_visible = data.isVisible
    
    const { data: updated, error } = await (this.supabase as any)
      .from('user_plan_display_settings')
      .update(updateData)
      .eq('subscription_id', subscriptionId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Display settings not found')
    return mapDisplaySettings(updated)
  }
}
