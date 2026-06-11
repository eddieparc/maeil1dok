/// <reference lib="es2019" />

/**
 * Bible Data Composable
 *
 * 성경 책/장 데이터, 역본 정보, 검색 관련 함수 제공
 */

import { VERSE_COUNTS, getVerseCount, isValidReference } from './bibleVerseData';
import {
  extractChosung,
  isChosungOnly,
  parseBibleSearchQuery,
  type BibleSearchResult,
} from '../utils/bibleSearch';

export interface BibleBook {
  id: string;
  name: string;
  chapters: number;
}

export type SearchResult = BibleSearchResult;

export const VERSION_NAMES = Object.freeze({
  GAE: "개역개정",
  KNT: "새한글",
  WOORI: "우리말성경",
  SAENEW: "새번역",
  HAN: "개역한글",
  SAE: "표준새번역",
  COG: "공동번역",
  COGNEW: "공동번역 개정판",
  HEB: "히브리어 (WLC)",
  GRK: "헬라어 (SBLGNT)",
  KJV: "KJV",
  WEB: "WEB",
  ASV: "ASV",
}) as Record<string, string>;

export const VERSION_CATEGORIES = Object.freeze({
  korean: ['GAE', 'KNT', 'WOORI', 'SAENEW', 'HAN', 'SAE', 'COG', 'COGNEW'],
  original: [] as string[],
  english: [] as string[],
});

const UNSUPPORTED_VERSIONS = new Set(['HEB', 'GRK', 'KJV', 'WEB', 'ASV']);

export const VISIBLE_VERSION_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(VERSION_NAMES).filter(([code]) => !UNSUPPORTED_VERSIONS.has(code))
  )
) as Record<string, string>;

export const VERSION_META = Object.freeze({
  HEB: { direction: 'rtl', language: 'hebrew', testament: 'old' },
  GRK: { direction: 'ltr', language: 'greek', testament: 'new' },
  KJV: { direction: 'ltr', language: 'english', testament: 'both' },
  WEB: { direction: 'ltr', language: 'english', testament: 'both' },
  ASV: { direction: 'ltr', language: 'english', testament: 'both' },
  GAE: { direction: 'ltr', language: 'korean', testament: 'both' },
  KNT: { direction: 'ltr', language: 'korean', testament: 'both' },
  WOORI: { direction: 'ltr', language: 'korean', testament: 'both' },
  SAENEW: { direction: 'ltr', language: 'korean', testament: 'both' },
  HAN: { direction: 'ltr', language: 'korean', testament: 'both' },
  SAE: { direction: 'ltr', language: 'korean', testament: 'both' },
  COG: { direction: 'ltr', language: 'korean', testament: 'both' },
  COGNEW: { direction: 'ltr', language: 'korean', testament: 'both' },
}) as Record<string, { direction: string; language: string; testament: string }>;

// 성경 책 정보
export const BIBLE_BOOKS: { old: BibleBook[]; new: BibleBook[] } = {
  old: [
    { id: "gen", name: "창세기", chapters: 50 },
    { id: "exo", name: "출애굽기", chapters: 40 },
    { id: "lev", name: "레위기", chapters: 27 },
    { id: "num", name: "민수기", chapters: 36 },
    { id: "deu", name: "신명기", chapters: 34 },
    { id: "jos", name: "여호수아", chapters: 24 },
    { id: "jdg", name: "사사기", chapters: 21 },
    { id: "rut", name: "룻기", chapters: 4 },
    { id: "1sa", name: "사무엘상", chapters: 31 },
    { id: "2sa", name: "사무엘하", chapters: 24 },
    { id: "1ki", name: "열왕기상", chapters: 22 },
    { id: "2ki", name: "열왕기하", chapters: 25 },
    { id: "1ch", name: "역대상", chapters: 29 },
    { id: "2ch", name: "역대하", chapters: 36 },
    { id: "ezr", name: "에스라", chapters: 10 },
    { id: "neh", name: "느헤미야", chapters: 13 },
    { id: "est", name: "에스더", chapters: 10 },
    { id: "job", name: "욥기", chapters: 42 },
    { id: "psa", name: "시편", chapters: 150 },
    { id: "pro", name: "잠언", chapters: 31 },
    { id: "ecc", name: "전도서", chapters: 12 },
    { id: "sng", name: "아가", chapters: 8 },
    { id: "isa", name: "이사야", chapters: 66 },
    { id: "jer", name: "예레미야", chapters: 52 },
    { id: "lam", name: "예레미야애가", chapters: 5 },
    { id: "ezk", name: "에스겔", chapters: 48 },
    { id: "dan", name: "다니엘", chapters: 12 },
    { id: "hos", name: "호세아", chapters: 14 },
    { id: "jol", name: "요엘", chapters: 3 },
    { id: "amo", name: "아모스", chapters: 9 },
    { id: "oba", name: "오바댜", chapters: 1 },
    { id: "jnh", name: "요나", chapters: 4 },
    { id: "mic", name: "미가", chapters: 7 },
    { id: "nam", name: "나훔", chapters: 3 },
    { id: "hab", name: "하박국", chapters: 3 },
    { id: "zep", name: "스바냐", chapters: 3 },
    { id: "hag", name: "학개", chapters: 2 },
    { id: "zec", name: "스가랴", chapters: 14 },
    { id: "mal", name: "말라기", chapters: 4 },
  ],
  new: [
    { id: "mat", name: "마태복음", chapters: 28 },
    { id: "mrk", name: "마가복음", chapters: 16 },
    { id: "luk", name: "누가복음", chapters: 24 },
    { id: "jhn", name: "요한복음", chapters: 21 },
    { id: "act", name: "사도행전", chapters: 28 },
    { id: "rom", name: "로마서", chapters: 16 },
    { id: "1co", name: "고린도전서", chapters: 16 },
    { id: "2co", name: "고린도후서", chapters: 13 },
    { id: "gal", name: "갈라디아서", chapters: 6 },
    { id: "eph", name: "에베소서", chapters: 6 },
    { id: "php", name: "빌립보서", chapters: 4 },
    { id: "col", name: "골로새서", chapters: 4 },
    { id: "1th", name: "데살로니가전서", chapters: 5 },
    { id: "2th", name: "데살로니가후서", chapters: 3 },
    { id: "1ti", name: "디모데전서", chapters: 6 },
    { id: "2ti", name: "디모데후서", chapters: 4 },
    { id: "tit", name: "디도서", chapters: 3 },
    { id: "phm", name: "빌레몬서", chapters: 1 },
    { id: "heb", name: "히브리서", chapters: 13 },
    { id: "jas", name: "야고보서", chapters: 5 },
    { id: "1pe", name: "베드로전서", chapters: 5 },
    { id: "2pe", name: "베드로후서", chapters: 3 },
    { id: "1jn", name: "요한일서", chapters: 5 },
    { id: "2jn", name: "요한이서", chapters: 1 },
    { id: "3jn", name: "요한삼서", chapters: 1 },
    { id: "jud", name: "유다서", chapters: 1 },
    { id: "rev", name: "요한계시록", chapters: 22 },
  ],
};

// 성경 책 약어 매핑 (한글 약어 → 책 id)
export const BOOK_ALIASES: Record<string, string> = {
  // 구약
  창: "gen", 창세: "gen", 창세기: "gen",
  출: "exo", 출애: "exo", 출애굽: "exo", 출애굽기: "exo",
  레: "lev", 레위: "lev", 레위기: "lev",
  민: "num", 민수: "num", 민수기: "num",
  신: "deu", 신명: "deu", 신명기: "deu",
  수: "jos", 여호: "jos", 여호수아: "jos",
  삿: "jdg", 사사: "jdg", 사사기: "jdg",
  룻: "rut", 룻기: "rut",
  삼상: "1sa", 사무엘상: "1sa", "사상": "1sa",
  삼하: "2sa", 사무엘하: "2sa", "사하": "2sa",
  왕상: "1ki", 열왕기상: "1ki", "열상": "1ki",
  왕하: "2ki", 열왕기하: "2ki", "열하": "2ki",
  대상: "1ch", 역대상: "1ch", "역상": "1ch",
  대하: "2ch", 역대하: "2ch", "역하": "2ch",
  스: "ezr", 에스라: "ezr",
  느: "neh", 느헤: "neh", 느헤미야: "neh",
  에: "est", 에스더: "est",
  욥: "job", 욥기: "job",
  시: "psa", 시편: "psa",
  잠: "pro", 잠언: "pro",
  전: "ecc", 전도: "ecc", 전도서: "ecc",
  아: "sng", 아가: "sng",
  사: "isa", 이사야: "isa",
  렘: "jer", 예레: "jer", 예레미야: "jer",
  애: "lam", 애가: "lam", 예레미야애가: "lam",
  겔: "ezk", 에스겔: "ezk",
  단: "dan", 다니엘: "dan",
  호: "hos", 호세아: "hos",
  욜: "jol", 요엘: "jol",
  암: "amo", 아모스: "amo",
  옵: "oba", 오바댜: "oba",
  욘: "jnh", 요나: "jnh",
  미: "mic", 미가: "mic",
  나: "nam", 나훔: "nam",
  합: "hab", 하박국: "hab",
  습: "zep", 스바냐: "zep",
  학: "hag", 학개: "hag",
  슥: "zec", 스가랴: "zec",
  말: "mal", 말라기: "mal",
  // 신약
  마: "mat", 마태: "mat", 마태복음: "mat",
  막: "mrk", 마가: "mrk", 마가복음: "mrk",
  눅: "luk", 누가: "luk", 누가복음: "luk",
  요: "jhn", 요한: "jhn", 요한복음: "jhn",
  행: "act", 사도: "act", 사도행전: "act",
  롬: "rom", 로마: "rom", 로마서: "rom",
  고전: "1co", 고린도전서: "1co", "고린전": "1co",
  고후: "2co", 고린도후서: "2co", "고린후": "2co",
  갈: "gal", 갈라디아: "gal", 갈라디아서: "gal",
  엡: "eph", 에베소: "eph", 에베소서: "eph",
  빌: "php", 빌립보: "php", 빌립보서: "php",
  골: "col", 골로새: "col", 골로새서: "col",
  살전: "1th", 데살로니가전서: "1th", "데전": "1th",
  살후: "2th", 데살로니가후서: "2th", "데후": "2th",
  딤전: "1ti", 디모데전서: "1ti", "디전": "1ti",
  딤후: "2ti", 디모데후서: "2ti", "디후": "2ti",
  딛: "tit", 디도: "tit", 디도서: "tit",
  몬: "phm", 빌레몬: "phm", 빌레몬서: "phm",
  히: "heb", 히브리: "heb", 히브리서: "heb",
  약: "jas", 야고보: "jas", 야고보서: "jas",
  벧전: "1pe", 베드로전서: "1pe", "베전": "1pe",
  벧후: "2pe", 베드로후서: "2pe", "베후": "2pe",
  요일: "1jn", 요한일서: "1jn",
  요이: "2jn", 요한이서: "2jn",
  요삼: "3jn", 요한삼서: "3jn",
  유: "jud", 유다: "jud", 유다서: "jud",
  계: "rev", 요한계시록: "rev", 계시록: "rev",
};

export const useBibleData = () => {
  // 모든 책 배열
  const allBooks = [...BIBLE_BOOKS.old, ...BIBLE_BOOKS.new];

  // bookNames 객체 생성
  const bookNames: Record<string, string> = {};
  allBooks.forEach((book) => {
    bookNames[book.id] = book.name;
  });

  // bookChapters 객체 생성
  const bookChapters: Record<string, number> = {};
  allBooks.forEach((book) => {
    bookChapters[book.id] = book.chapters;
  });

  const isPsalms = (bookId: string): boolean => bookId === 'psa';

  const getChapterUnit = (bookId: string): string => isPsalms(bookId) ? '편' : '장';

  const getBookName = (bookId: string): string => {
    return bookNames[bookId] || bookId;
  };

  /**
   * 책 ID로 장 수 조회
   */
  const getChapterCount = (bookId: string): number => {
    return bookChapters[bookId] || 1;
  };

  /**
   * 책 ID로 장 배열 생성
   */
  const getChaptersArray = (bookId: string): number[] => {
    const count = getChapterCount(bookId);
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  /**
   * 스마트 검색 - 여러 후보 결과 반환 (초성 및 절 지원)
   */
  const parseSearchQuery = (query: string): SearchResult[] => {
    return parseBibleSearchQuery(query, {
      allBooks,
      aliases: BOOK_ALIASES,
      bookNames,
      bookChapters,
      getVerseCount,
    });
  };

  return {
    bibleBooks: BIBLE_BOOKS,
    versionNames: VERSION_NAMES,
    bookAliases: BOOK_ALIASES,
    allBooks,
    bookNames,
    bookChapters,

    getBookName,
    getChapterCount,
    getChaptersArray,
    getChapterUnit,
    isPsalms,
    parseSearchQuery,
    extractChosung,
    isChosungOnly,
  };
};
