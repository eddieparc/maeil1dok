import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

import { createClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function restoreEnv(name: string, original: string | undefined) {
  if (original === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = original
  }
}

describe('createServiceRoleClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  afterEach(() => {
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINAL_URL)
    restoreEnv('SUPABASE_SERVICE_ROLE_KEY', ORIGINAL_KEY)
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    expect(() => createServiceRoleClient()).toThrow(
      'Supabase service credentials are not configured'
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createServiceRoleClient()).toThrow(
      'Supabase service credentials are not configured'
    )
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates a service-role client with session persistence disabled', () => {
    createServiceRoleClient()

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  })
})
