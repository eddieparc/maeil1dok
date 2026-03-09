import { describe, expect, it } from 'vitest'
import { disassembleHangul, searchBibleBooks } from '@/lib/bible/search'

describe('disassembleHangul', () => {
  it('extracts chosung from Korean text', () => {
    // disassembleHangul returns chosung characters for each syllable
    expect(disassembleHangul('창세기')).toBe('ㅊㅅㄱ')
    expect(disassembleHangul('마태복음')).toBe('ㅁㅌㅂㅇ')
    expect(disassembleHangul('요한계시록')).toBe('ㅇㅎㄱㅅㄹ')
  })

  it('handles single character', () => {
    expect(disassembleHangul('창')).toBe('ㅊ')
    expect(disassembleHangul('마')).toBe('ㅁ')
  })

  it('handles multiple words', () => {
    expect(disassembleHangul('사무엘상')).toBe('ㅅㅁㅇㅅ')
    expect(disassembleHangul('데살로니가전서')).toBe('ㄷㅅㄹㄴㄱㅈㅅ')
  })

  it('preserves already-chosung characters', () => {
    expect(disassembleHangul('ㄱ')).toBe('ㄱ')
    expect(disassembleHangul('ㄱㄴㄷ')).toBe('ㄱㄴㄷ')
  })

  it('ignores non-Korean characters', () => {
    expect(disassembleHangul('abc')).toBe('')
    expect(disassembleHangul('123')).toBe('')
    expect(disassembleHangul('창abc')).toBe('ㅊ')
  })

  it('handles empty string', () => {
    expect(disassembleHangul('')).toBe('')
  })

  it('handles mixed Korean and non-Korean', () => {
    expect(disassembleHangul('창세기123')).toBe('ㅊㅅㄱ')
  })
})

describe('searchBibleBooks', () => {
  it('returns empty array for empty query', () => {
    expect(searchBibleBooks('')).toEqual([])
    expect(searchBibleBooks('   ')).toEqual([])
  })

  it('finds books by exact Korean name', () => {
    const result = searchBibleBooks('창세기')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('gen')
    expect(result[0].ko).toBe('창세기')
  })

  it('finds books by chosung', () => {
    const result = searchBibleBooks('창')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('gen')
  })

  it('finds multiple books with same chosung', () => {
    const result = searchBibleBooks('마')
    // Should find 마태복음, 마가복음
    expect(result.length).toBeGreaterThanOrEqual(2)
    const ids = result.map(b => b.id)
    expect(ids).toContain('mat')
    expect(ids).toContain('mrk')
  })

  it('finds books by partial name match', () => {
    const result = searchBibleBooks('사무')
    expect(result.length).toBeGreaterThan(0)
    const ids = result.map(b => b.id)
    expect(ids).toContain('1sa')
    expect(ids).toContain('2sa')
  })

  it('returns results in canonical order', () => {
    const result = searchBibleBooks('마')
    // Should be in order: mat, mrk
    const ids = result.map(b => b.id)
    const matIndex = ids.indexOf('mat')
    const mrkIndex = ids.indexOf('mrk')
    expect(matIndex).toBeLessThan(mrkIndex)
  })

  it('includes all book info fields', () => {
    const result = searchBibleBooks('창세기')
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('ko')
    expect(result[0]).toHaveProperty('chapters')
    expect(result[0]).toHaveProperty('chosung')
  })

  it('finds Genesis with various queries', () => {
    const queries = ['창세기', '창', '창세']
    for (const query of queries) {
      const result = searchBibleBooks(query)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].id).toBe('gen')
    }
  })

  it('finds Psalms correctly', () => {
    const result = searchBibleBooks('시편')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('psa')
    expect(result[0].chapters).toBe(150)
  })

  it('finds Revelation correctly', () => {
    const result = searchBibleBooks('요한계시록')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('rev')
  })

  it('handles chosung with multiple matches', () => {
    const result = searchBibleBooks('요')
    // Should find 요엘, 요나, 요한복음, 요한계시록
    expect(result.length).toBeGreaterThanOrEqual(4)
    const ids = result.map(b => b.id)
    expect(ids).toContain('jol')
    expect(ids).toContain('jon')
    expect(ids).toContain('jhn')
    expect(ids).toContain('rev')
  })

  it('does not return duplicates', () => {
    const result = searchBibleBooks('창')
    const ids = result.map(b => b.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('finds books with complex chosung', () => {
    const result = searchBibleBooks('데')
    expect(result.length).toBeGreaterThan(0)
    const ids = result.map(b => b.id)
    expect(ids).toContain('1th')
    expect(ids).toContain('2th')
  })

  it('handles whitespace in query', () => {
    const result1 = searchBibleBooks('창세기')
    const result2 = searchBibleBooks('  창세기  ')
    expect(result1).toEqual(result2)
  })
})
