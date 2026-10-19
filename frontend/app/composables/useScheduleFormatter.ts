/**
 * 성경 읽기 일정 포맷팅 composable
 * 성경 책 이름을 축약형으로 변환하고 일정을 포맷팅합니다.
 */

// 66권 성경 축약어 맵
import { ALL_BOOKS, getBookAbbreviation as canonicalAbbreviation, getBookCode as canonicalBookCode } from '~/constants/bible'

// Derived from the canonical book table (~/constants/bible) — single source.
const BOOK_ABBREVIATIONS: Record<string, string> = Object.fromEntries(
  ALL_BOOKS.map((b) => [b.name, b.abbreviation]),
)
const BOOK_CODES: Record<string, string> = Object.fromEntries(
  ALL_BOOKS.map((b) => [b.name, b.id]),
)

export interface ScheduleItem {
  book: string
  start_chapter?: number
  end_chapter?: number
  chapters?: string
}

export function useScheduleFormatter() {
  /**
   * 성경 책 이름을 축약어로 변환
   * @example getAbbreviation('히브리서') => '히'
   */
  const getAbbreviation = (book: string): string => canonicalAbbreviation(book)

  /**
   * 성경 책 이름을 코드로 변환 (네비게이션용)
   * @example getBookCode('히브리서') => 'heb'
   */
  const getBookCode = (book: string): string | null => canonicalBookCode(book)

  /**
   * 일정을 축약 형식으로 변환
   * @example formatSchedule('히브리서', 1, 6) => '히 1-6'
   * @example formatSchedule('시편', 119, 119) => '시 119'
   */
  const formatSchedule = (book: string, startChapter: number, endChapter: number): string => {
    const abbr = getAbbreviation(book)
    if (startChapter === endChapter) {
      return `${abbr} ${startChapter}`
    }
    return `${abbr} ${startChapter}-${endChapter}`
  }

  /**
   * chapters 문자열에서 시작/끝 장 추출
   * @example parseChapters('1-6장') => { start: 1, end: 6 }
   */
  const parseChapters = (chapters: string): { start: number; end: number } | null => {
    const match = chapters.match(/(\d+)(?:-(\d+))?/)
    if (!match) return null
    const start = parseInt(match[1], 10)
    const end = match[2] ? parseInt(match[2], 10) : start
    return { start, end }
  }

  /**
   * 여러 일정을 결합하여 표시
   * @example combineSchedules([{book: '히브리서', ...}, {book: '빌립보서', ...}]) => '히 1-6, 빌 1-3'
   */
  const combineSchedules = (schedules: ScheduleItem[], maxLength = 20): string => {
    const formatted = schedules.map(s => {
      if (s.start_chapter && s.end_chapter) {
        return formatSchedule(s.book, s.start_chapter, s.end_chapter)
      }
      if (s.chapters) {
        const parsed = parseChapters(s.chapters)
        if (parsed) {
          return formatSchedule(s.book, parsed.start, parsed.end)
        }
      }
      return getAbbreviation(s.book)
    })

    const combined = formatted.join(', ')
    if (combined.length > maxLength) {
      return combined.slice(0, maxLength - 3) + '...'
    }
    return combined
  }

  return {
    BOOK_ABBREVIATIONS,
    BOOK_CODES,
    getAbbreviation,
    getBookCode,
    formatSchedule,
    parseChapters,
    combineSchedules,
  }
}
