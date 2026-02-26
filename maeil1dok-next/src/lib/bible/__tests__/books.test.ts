import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS, BIBLE_BOOK_KEYS } from '@/lib/bible/books'

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
})
