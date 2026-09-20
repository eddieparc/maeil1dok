/**
 * 성경 읽기 일정 포맷팅 composable
 * 성경 책 이름을 축약형으로 변환하고 일정을 포맷팅합니다.
 */

// 66권 성경 축약어 맵
const BOOK_ABBREVIATIONS: Record<string, string> = {
  // 구약 (39권)
  '창세기': '창',
  '출애굽기': '출',
  '레위기': '레',
  '민수기': '민',
  '신명기': '신',
  '여호수아': '수',
  '사사기': '삿',
  '룻기': '룻',
  '사무엘상': '삼상',
  '사무엘하': '삼하',
  '열왕기상': '왕상',
  '열왕기하': '왕하',
  '역대상': '대상',
  '역대하': '대하',
  '에스라': '스',
  '느헤미야': '느',
  '에스더': '에',
  '욥기': '욥',
  '시편': '시',
  '잠언': '잠',
  '전도서': '전',
  '아가': '아',
  '이사야': '사',
  '예레미야': '렘',
  '예레미야애가': '애',
  '에스겔': '겔',
  '다니엘': '단',
  '호세아': '호',
  '요엘': '욜',
  '아모스': '암',
  '오바댜': '옵',
  '요나': '욘',
  '미가': '미',
  '나훔': '나',
  '하박국': '합',
  '스바냐': '습',
  '학개': '학',
  '스가랴': '슥',
  '말라기': '말',
  // 신약 (27권)
  '마태복음': '마',
  '마가복음': '막',
  '누가복음': '눅',
  '요한복음': '요',
  '사도행전': '행',
  '로마서': '롬',
  '고린도전서': '고전',
  '고린도후서': '고후',
  '갈라디아서': '갈',
  '에베소서': '엡',
  '빌립보서': '빌',
  '골로새서': '골',
  '데살로니가전서': '살전',
  '데살로니가후서': '살후',
  '디모데전서': '딤전',
  '디모데후서': '딤후',
  '디도서': '딛',
  '빌레몬서': '몬',
  '히브리서': '히',
  '야고보서': '약',
  '베드로전서': '벧전',
  '베드로후서': '벧후',
  '요한일서': '요일',
  '요한이서': '요이',
  '요한삼서': '요삼',
  '유다서': '유',
  '요한계시록': '계',
}

// 성경 책 코드 맵 (네비게이션용)
const BOOK_CODES: Record<string, string> = {
  '창세기': 'gen', '출애굽기': 'exo', '레위기': 'lev', '민수기': 'num', '신명기': 'deu',
  '여호수아': 'jos', '사사기': 'jdg', '룻기': 'rut', '사무엘상': '1sa', '사무엘하': '2sa',
  '열왕기상': '1ki', '열왕기하': '2ki', '역대상': '1ch', '역대하': '2ch',
  '에스라': 'ezr', '느헤미야': 'neh', '에스더': 'est', '욥기': 'job', '시편': 'psa',
  '잠언': 'pro', '전도서': 'ecc', '아가': 'sng', '이사야': 'isa', '예레미야': 'jer',
  '예레미야애가': 'lam', '에스겔': 'ezk', '다니엘': 'dan', '호세아': 'hos', '요엘': 'jol',
  '아모스': 'amo', '오바댜': 'oba', '요나': 'jnh', '미가': 'mic', '나훔': 'nam',
  '하박국': 'hab', '스바냐': 'zep', '학개': 'hag', '스가랴': 'zec', '말라기': 'mal',
  '마태복음': 'mat', '마가복음': 'mrk', '누가복음': 'luk', '요한복음': 'jhn',
  '사도행전': 'act', '로마서': 'rom', '고린도전서': '1co', '고린도후서': '2co',
  '갈라디아서': 'gal', '에베소서': 'eph', '빌립보서': 'php', '골로새서': 'col',
  '데살로니가전서': '1th', '데살로니가후서': '2th', '디모데전서': '1ti', '디모데후서': '2ti',
  '디도서': 'tit', '빌레몬서': 'phm', '히브리서': 'heb', '야고보서': 'jas',
  '베드로전서': '1pe', '베드로후서': '2pe', '요한일서': '1jn', '요한이서': '2jn',
  '요한삼서': '3jn', '유다서': 'jud', '요한계시록': 'rev',
}

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
  const getAbbreviation = (book: string): string => {
    return BOOK_ABBREVIATIONS[book] || (book ? book.slice(0, 2) : '')
  }

  /**
   * 성경 책 이름을 코드로 변환 (네비게이션용)
   * @example getBookCode('히브리서') => 'heb'
   */
  const getBookCode = (book: string): string | null => {
    return BOOK_CODES[book] || null
  }

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
