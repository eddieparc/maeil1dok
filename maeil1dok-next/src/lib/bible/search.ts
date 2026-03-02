/**
 * Bible Search Utilities
 *
 * Pure TypeScript functions for Bible book searching and Hangul processing
 * No external dependencies
 */

import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from './books'

/**
 * Hangul chosung (initial consonant) list
 * 한글 초성 19자
 */
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/**
 * Disassemble Hangul text into chosung (initial consonants)
 *
 * Converts Korean text to its initial consonants.
 * Example: '창세기' → '창'
 *
 * @param text - Korean text to disassemble
 * @returns String of chosung characters
 */
export function disassembleHangul(text: string): string {
  let result = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (!char) continue

    const code = char.charCodeAt(0)

    // Hangul syllable range (가 ~ 힣): U+AC00 ~ U+D7A3
    if (code >= 0xac00 && code <= 0xd7a3) {
      // Extract chosung index from syllable code
      // Formula: (code - 0xAC00) / 588 gives chosung index
      const chosungIndex = Math.floor((code - 0xac00) / 588)
      result += CHOSUNG_LIST[chosungIndex]
    } else if (CHOSUNG_LIST.includes(char as any)) {
      // Already a chosung character, add as-is
      result += char
    }
  }

  return result
}

/**
 * Book info for search results
 */
export interface BookInfo {
  id: string
  ko: string
  chapters: number
  chosung: string
}

/**
 * Search Bible books by name or chosung
 *
 * Supports:
 * - Full Korean name: '창세기'
 * - Chosung: '창'
 * - Partial match: '창' matches '창세기'
 *
 * @param query - Search query (Korean name or chosung)
 * @returns Array of matching books in canonical order
 */
export function searchBibleBooks(query: string): BookInfo[] {
  if (!query || query.trim() === '') {
    return []
  }

  const trimmed = query.trim()
  const results: BookInfo[] = []
  const seen = new Set<string>()

  // Check each book in canonical order
  for (const bookId of BIBLE_BOOK_ORDER) {
    const book = BIBLE_BOOKS[bookId]
    if (!book) continue

    const bookInfo: BookInfo = {
      id: bookId,
      ko: book.ko,
      chapters: book.chapters,
      chosung: book.chosung,
    }

    // Exact name match
    if (book.ko === trimmed) {
      if (!seen.has(bookId)) {
        results.push(bookInfo)
        seen.add(bookId)
      }
      continue
    }

    // Chosung match (exact or prefix)
    const bookChosung = disassembleHangul(book.ko)
    if (bookChosung === trimmed || bookChosung.startsWith(trimmed)) {
      if (!seen.has(bookId)) {
        results.push(bookInfo)
        seen.add(bookId)
      }
      continue
    }

    // Partial name match (prefix or contains)
    if (book.ko.startsWith(trimmed) || book.ko.includes(trimmed)) {
      if (!seen.has(bookId)) {
        results.push(bookInfo)
        seen.add(bookId)
      }
      continue
    }
  }

  return results
}
