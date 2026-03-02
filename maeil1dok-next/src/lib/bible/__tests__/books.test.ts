import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS, BIBLE_BOOK_KEYS, BIBLE_VERSIONS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'

describe('BIBLE_BOOKS', () => {
  it('has exactly 66 books', () => {
    expect(Object.keys(BIBLE_BOOKS)).toHaveLength(66)
  })

  it('Genesis (gen) has 50 chapters', () => {
    expect(BIBLE_BOOKS.gen.chapters).toBe(50)
  })

  it('Psalms (psa) has 150 chapters', () => {
    expect(BIBLE_BOOKS.psa.chapters).toBe(150)
  })

  it('Revelation (rev) has 22 chapters', () => {
    expect(BIBLE_BOOKS.rev.chapters).toBe(22)
  })

  it('all books have non-empty Korean names', () => {
    for (const [key, book] of Object.entries(BIBLE_BOOKS)) {
      expect(book.ko, `Book "${key}" is missing a Korean name`).toBeTruthy()
      expect(typeof book.ko).toBe('string')
      expect(book.ko.length).toBeGreaterThan(0)
    }
  })

  it('BIBLE_BOOK_KEYS matches Object.keys(BIBLE_BOOKS)', () => {
    expect(BIBLE_BOOK_KEYS).toEqual(Object.keys(BIBLE_BOOKS))
  })

  it('all books have chosung field', () => {
    for (const [key, book] of Object.entries(BIBLE_BOOKS)) {
      expect(book.chosung, `Book "${key}" is missing chosung`).toBeTruthy()
      expect(typeof book.chosung).toBe('string')
      expect(book.chosung.length).toBeGreaterThan(0)
    }
  })

  it('chosung values are single Korean characters', () => {
    for (const [key, book] of Object.entries(BIBLE_BOOKS)) {
      expect(book.chosung.length).toBe(1)
    }
  })
})

describe('BIBLE_VERSIONS', () => {
  it('includes WOORI version', () => {
    expect(BIBLE_VERSIONS.WOORI).toBe('우리말성경')
  })

  it('has all expected versions', () => {
    const expectedVersions = ['GAE', 'KNT', 'WOORI', 'HAN', 'SAE', 'SAENEW', 'COG', 'COGNEW']
    for (const version of expectedVersions) {
      expect(BIBLE_VERSIONS[version as keyof typeof BIBLE_VERSIONS]).toBeTruthy()
    }
  })
})

describe('BIBLE_BOOK_ORDER', () => {
  it('has exactly 66 books', () => {
    expect(BIBLE_BOOK_ORDER).toHaveLength(66)
  })

  it('contains all books from BIBLE_BOOKS', () => {
    const bookIds = new Set(BIBLE_BOOK_ORDER)
    const expectedIds = new Set(Object.keys(BIBLE_BOOKS))
    expect(bookIds).toEqual(expectedIds)
  })

  it('maintains canonical order (OT then NT)', () => {
    // First book should be Genesis
    expect(BIBLE_BOOK_ORDER[0]).toBe('gen')
    // Last book should be Revelation
    expect(BIBLE_BOOK_ORDER[65]).toBe('rev')
    // Psalms should be in OT section
    const psalmIndex = BIBLE_BOOK_ORDER.indexOf('psa')
    expect(psalmIndex).toBeLessThan(39) // OT has 39 books
    // Matthew (first NT book) should be after all OT books
    const matIndex = BIBLE_BOOK_ORDER.indexOf('mat')
    expect(matIndex).toBeGreaterThanOrEqual(39)
  })

  it('has no duplicate books', () => {
    const bookIds = BIBLE_BOOK_ORDER
    const uniqueIds = new Set(bookIds)
    expect(uniqueIds.size).toBe(bookIds.length)
  })
})
