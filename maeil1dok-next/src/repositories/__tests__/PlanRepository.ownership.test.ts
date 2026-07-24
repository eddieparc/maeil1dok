import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabasePlanRepository } from '@/repositories/implementations/SupabasePlanRepository'
import { AuthError, NetworkError, NotFoundError } from '@/repositories/types/errors'

function createMockSupabase() {
  const chainableQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  const from = vi.fn().mockReturnValue(chainableQuery)
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'current-user' } },
      error: null,
    }),
  }

  return { from, auth, chainableQuery }
}

const displaySettingsRow = {
  id: 'ds-1',
  user_id: 'current-user',
  subscription_id: 'sub-1',
  color: '#3B82F6',
  display_order: 0,
  is_visible: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const subscriptionRow = {
  id: 'sub-1',
  user_id: 'current-user',
  plan_id: 7,
  start_date: '2026-07-08',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

// Separate per-table chains so we can assert the active-plan lookup on
// bible_reading_plans runs before (and can veto) the plan_subscriptions insert.
function createSubscribeMockSupabase(options?: {
  planLookup?: { data: unknown; error: unknown }
  existingSubscription?: { data: unknown; error: unknown }
  writeResult?: { data: unknown; error: unknown }
}) {
  const planQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      options?.planLookup ?? { data: { id: subscriptionRow.plan_id }, error: null },
    ),
  }
  const subscriptionQuery = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // Idempotency lookup for an existing (user_id, plan_id) row.
    maybeSingle: vi.fn().mockResolvedValue(
      options?.existingSubscription ?? { data: null, error: null },
    ),
    // Result of the insert OR reactivating update.
    single: vi.fn().mockResolvedValue(
      options?.writeResult ?? { data: subscriptionRow, error: null },
    ),
  }

  const from = vi.fn((table: string) => {
    if (table === 'bible_reading_plans') return planQuery
    if (table === 'plan_subscriptions') return subscriptionQuery
    throw new Error(`unexpected table ${table}`)
  })
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'current-user' } },
      error: null,
    }),
  }

  return { from, auth, planQuery, subscriptionQuery }
}

describe('SupabasePlanRepository — object-ownership on mutations', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabasePlanRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabasePlanRepository(mockSupabase as never)
  })

  describe('unsubscribeFromPlan', () => {
    it('scopes the deactivation to both the subscription id AND the current user (no IDOR)', async () => {
      mockSupabase.chainableQuery.eq.mockReturnValueOnce(mockSupabase.chainableQuery)
      mockSupabase.chainableQuery.eq.mockResolvedValueOnce({ error: null })

      await repo.unsubscribeFromPlan('sub-belonging-to-someone-else')

      expect(mockSupabase.from).toHaveBeenCalledWith('plan_subscriptions')
      expect(mockSupabase.chainableQuery.update).toHaveBeenCalledWith({ is_active: false })
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('id', 'sub-belonging-to-someone-else')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('user_id', 'current-user')
    })

    it('throws AuthError and performs NO write when the caller is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(repo.unsubscribeFromPlan('sub-1')).rejects.toBeInstanceOf(AuthError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('throws AuthError when auth.getUser reports an error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('session expired'),
      })

      await expect(repo.unsubscribeFromPlan('sub-1')).rejects.toBeInstanceOf(AuthError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
    })
  })

  describe('updateDisplaySettings', () => {
    it('scopes the update to both the subscription id AND the current user (no IDOR)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({ data: displaySettingsRow, error: null })

      await repo.updateDisplaySettings('sub-1', { color: '#FF0000' })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_plan_display_settings')
      expect(mockSupabase.chainableQuery.update).toHaveBeenCalledWith({ color: '#FF0000' })
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('subscription_id', 'sub-1')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('user_id', 'current-user')
    })

    it('throws AuthError and performs NO write when the caller is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(
        repo.updateDisplaySettings('sub-1', { color: '#FF0000' }),
      ).rejects.toBeInstanceOf(AuthError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })
})

describe('SupabasePlanRepository — subscribeToPlan active-plan gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('looks up the active plan BEFORE inserting the subscription', async () => {
    const mock = createSubscribeMockSupabase()
    const repo = new SupabasePlanRepository(mock as never)

    await repo.subscribeToPlan(7, '2026-07-08')

    const order = mock.from.mock.calls.map((call) => call[0])
    expect(order[0]).toBe('bible_reading_plans')
    expect(order).toContain('plan_subscriptions')
    expect(order.indexOf('bible_reading_plans')).toBeLessThan(
      order.indexOf('plan_subscriptions'),
    )
    expect(mock.planQuery.eq).toHaveBeenCalledWith('id', 7)
    expect(mock.planQuery.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('throws NotFoundError and performs NO insert when the plan is missing/inactive (PGRST116)', async () => {
    const mock = createSubscribeMockSupabase({
      planLookup: { data: null, error: { code: 'PGRST116', message: 'No rows' } },
    })
    const repo = new SupabasePlanRepository(mock as never)

    await expect(repo.subscribeToPlan(7, '2026-07-08')).rejects.toBeInstanceOf(NotFoundError)
    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalledWith('plan_subscriptions')
  })

  it('throws NotFoundError and performs NO insert when the lookup returns no data and no error', async () => {
    const mock = createSubscribeMockSupabase({
      planLookup: { data: null, error: null },
    })
    const repo = new SupabasePlanRepository(mock as never)

    await expect(repo.subscribeToPlan(7, '2026-07-08')).rejects.toBeInstanceOf(NotFoundError)
    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
  })

  it('throws NetworkError and performs NO insert on a non-PGRST116 lookup error', async () => {
    const mock = createSubscribeMockSupabase({
      planLookup: { data: null, error: { code: '500', message: 'boom' } },
    })
    const repo = new SupabasePlanRepository(mock as never)

    await expect(repo.subscribeToPlan(7, '2026-07-08')).rejects.toBeInstanceOf(NetworkError)
    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
  })

  it('inserts the subscription and returns the mapped result for an active plan', async () => {
    const mock = createSubscribeMockSupabase()
    const repo = new SupabasePlanRepository(mock as never)

    const result = await repo.subscribeToPlan(7, '2026-07-08')

    expect(mock.subscriptionQuery.insert).toHaveBeenCalledWith({
      user_id: 'current-user',
      plan_id: 7,
      start_date: '2026-07-08',
    })
    expect(result).toEqual({
      id: 'sub-1',
      userId: 'current-user',
      planId: 7,
      startDate: '2026-07-08',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('returns the existing ACTIVE subscription without inserting or updating (idempotent no-op)', async () => {
    const mock = createSubscribeMockSupabase({
      existingSubscription: { data: { ...subscriptionRow, is_active: true }, error: null },
    })
    const repo = new SupabasePlanRepository(mock as never)

    const result = await repo.subscribeToPlan(7, '2026-07-08')

    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
    expect(mock.subscriptionQuery.update).not.toHaveBeenCalled()
    expect(result.id).toBe('sub-1')
    expect(result.isActive).toBe(true)
  })

  it('reactivates an existing INACTIVE subscription with an owner-scoped update and no insert (no UNIQUE 500)', async () => {
    const mock = createSubscribeMockSupabase({
      existingSubscription: { data: { ...subscriptionRow, is_active: false }, error: null },
      writeResult: { data: { ...subscriptionRow, is_active: true }, error: null },
    })
    const repo = new SupabasePlanRepository(mock as never)

    const result = await repo.subscribeToPlan(7, '2026-07-08')

    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
    expect(mock.subscriptionQuery.update).toHaveBeenCalledTimes(1)
    const updateArg = mock.subscriptionQuery.update.mock.calls[0][0]
    expect(updateArg.is_active).toBe(true)
    expect(typeof updateArg.updated_at).toBe('string')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('id', 'sub-1')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('user_id', 'current-user')
    expect(result.isActive).toBe(true)
  })

  it('throws NetworkError and performs NO write when the idempotency lookup errors', async () => {
    const mock = createSubscribeMockSupabase({
      existingSubscription: { data: null, error: { message: 'boom' } },
    })
    const repo = new SupabasePlanRepository(mock as never)

    await expect(repo.subscribeToPlan(7, '2026-07-08')).rejects.toBeInstanceOf(NetworkError)
    expect(mock.subscriptionQuery.insert).not.toHaveBeenCalled()
    expect(mock.subscriptionQuery.update).not.toHaveBeenCalled()
  })
})

describe('SupabasePlanRepository — getDisplaySettingsForSubscriptions (bulk)', () => {
  function createBulkMock(result?: { data: unknown; error: unknown }) {
    const inFn = vi.fn().mockResolvedValue(result ?? { data: [displaySettingsRow], error: null })
    const select = vi.fn().mockReturnValue({ in: inFn })
    const from = vi.fn().mockReturnValue({ select })
    const auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'current-user' } }, error: null }),
    }
    return { from, auth, select, inFn }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns [] without touching the table for empty input', async () => {
    const mock = createBulkMock()
    const repo = new SupabasePlanRepository(mock as never)

    const result = await repo.getDisplaySettingsForSubscriptions([])

    expect(result).toEqual([])
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('queries user_plan_display_settings with de-duplicated subscription ids and maps rows', async () => {
    const mock = createBulkMock()
    const repo = new SupabasePlanRepository(mock as never)

    const result = await repo.getDisplaySettingsForSubscriptions(['sub-1', 'sub-1', 'sub-2'])

    expect(mock.from).toHaveBeenCalledWith('user_plan_display_settings')
    expect(mock.inFn).toHaveBeenCalledWith('subscription_id', ['sub-1', 'sub-2'])
    expect(result).toEqual([
      {
        id: 'ds-1',
        userId: 'current-user',
        subscriptionId: 'sub-1',
        color: '#3B82F6',
        displayOrder: 0,
        isVisible: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])
  })

  it('throws NetworkError when Supabase returns an error', async () => {
    const mock = createBulkMock({ data: null, error: { message: 'boom' } })
    const repo = new SupabasePlanRepository(mock as never)

    await expect(repo.getDisplaySettingsForSubscriptions(['sub-1'])).rejects.toBeInstanceOf(NetworkError)
  })
})
