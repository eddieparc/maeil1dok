import { describe, expect, it, vi } from 'vitest'
import { getSettings, updateSettings } from '@/repositories/bible/readingSettingsRepository'

function createQueryMock() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
  }
}

describe('readingSettingsRepository', () => {
  it('loads reading settings for a user', async () => {
    const query = createQueryMock()
    const row = { user_id: 'u1', theme: 'light', font_family: 'Pretendard' }
    query.single.mockResolvedValue({ data: row, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getSettings(supabase as never, 'u1')

    expect(supabase.from).toHaveBeenCalledWith('user_reading_settings')
    expect(result.data).toEqual(row)
    expect(result.error).toBeNull()
  })

  it('returns null when settings do not exist yet', async () => {
    const query = createQueryMock()
    query.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getSettings(supabase as never, 'u1')

    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('updates reading settings', async () => {
    const query = createQueryMock()
    query.single.mockResolvedValue({ data: { user_id: 'u1', theme: 'dark' }, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await updateSettings(supabase as never, 'u1', { theme: 'dark' })

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
    expect(result.data).toEqual({ user_id: 'u1', theme: 'dark' })
    expect(result.error).toBeNull()
  })
})
