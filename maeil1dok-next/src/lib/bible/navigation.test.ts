import { describe, it, expect } from 'vitest'
import { buildBibleNavigationUrl } from './navigation'

describe('buildBibleNavigationUrl', () => {
  it('should build correct URL for valid book (창세기)', () => {
    const result = buildBibleNavigationUrl({
      book: '창세기',
      startChapter: 2,
      id: 'abc-123',
      planId: 1,
    })
    expect(result).toBe('/bible?book=gen&chapter=2&tongdok=true&schedule=abc-123&plan=1')
  })

  it('should build correct URL for valid book (마태복음)', () => {
    const result = buildBibleNavigationUrl({
      book: '마태복음',
      startChapter: 5,
      id: 'def-456',
      planId: 2,
    })
    expect(result).toBe('/bible?book=mat&chapter=5&tongdok=true&schedule=def-456&plan=2')
  })

  it('should return null for invalid book name', () => {
    const result = buildBibleNavigationUrl({
      book: '알수없음',
      startChapter: 1,
      id: 'x',
      planId: 1,
    })
    expect(result).toBeNull()
  })

  it('should handle chapter 1 correctly', () => {
    const result = buildBibleNavigationUrl({
      book: '창세기',
      startChapter: 1,
      id: 'test-id',
      planId: 5,
    })
    expect(result).toBe('/bible?book=gen&chapter=1&tongdok=true&schedule=test-id&plan=5')
  })

  it('should handle large chapter numbers', () => {
    const result = buildBibleNavigationUrl({
      book: '시편',
      startChapter: 150,
      id: 'psalm-id',
      planId: 3,
    })
    expect(result).toBe('/bible?book=psa&chapter=150&tongdok=true&schedule=psalm-id&plan=3')
  })

  it('should handle UUID format IDs', () => {
    const result = buildBibleNavigationUrl({
      book: '요한복음',
      startChapter: 3,
      id: '550e8400-e29b-41d4-a716-446655440000',
      planId: 10,
    })
    expect(result).toBe(
      '/bible?book=jhn&chapter=3&tongdok=true&schedule=550e8400-e29b-41d4-a716-446655440000&plan=10'
    )
  })
})
