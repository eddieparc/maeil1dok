export const BIBLE_BOOKS: Record<string, { ko: string; chapters: number; chosung: string }> = {
  gen: { ko: '창세기', chapters: 50, chosung: '창' },
  exo: { ko: '출애굽기', chapters: 40, chosung: '출' },
  lev: { ko: '레위기', chapters: 27, chosung: '레' },
  num: { ko: '민수기', chapters: 36, chosung: '민' },
  deu: { ko: '신명기', chapters: 34, chosung: '신' },
  jos: { ko: '여호수아', chapters: 24, chosung: '여' },
  jdg: { ko: '사사기', chapters: 21, chosung: '사' },
  rut: { ko: '룻기', chapters: 4, chosung: '룻' },
  sa1: { ko: '사무엘상', chapters: 31, chosung: '삼' },
  sa2: { ko: '사무엘하', chapters: 24, chosung: '삼' },
  ki1: { ko: '열왕기상', chapters: 22, chosung: '왕' },
  ki2: { ko: '열왕기하', chapters: 25, chosung: '왕' },
  ch1: { ko: '역대상', chapters: 29, chosung: '대' },
  ch2: { ko: '역대하', chapters: 36, chosung: '대' },
  ezr: { ko: '에스라', chapters: 10, chosung: '에' },
  neh: { ko: '느헤미야', chapters: 13, chosung: '느' },
  est: { ko: '에스더', chapters: 10, chosung: '에' },
  job: { ko: '욥기', chapters: 42, chosung: '욥' },
  psa: { ko: '시편', chapters: 150, chosung: '시' },
  pro: { ko: '잠언', chapters: 31, chosung: '잠' },
  ecc: { ko: '전도서', chapters: 12, chosung: '전' },
  sng: { ko: '아가', chapters: 8, chosung: '아' },
  isa: { ko: '이사야', chapters: 66, chosung: '이' },
  jer: { ko: '예레미야', chapters: 52, chosung: '예' },
  lam: { ko: '예레미야애가', chapters: 5, chosung: '예' },
  eze: { ko: '에스겔', chapters: 48, chosung: '에' },
  dan: { ko: '다니엘', chapters: 12, chosung: '다' },
  hos: { ko: '호세아', chapters: 14, chosung: '호' },
  joe: { ko: '요엘', chapters: 3, chosung: '요' },
  amo: { ko: '아모스', chapters: 9, chosung: '아' },
  oba: { ko: '오바댜', chapters: 1, chosung: '오' },
  jon: { ko: '요나', chapters: 4, chosung: '요' },
  mic: { ko: '미가', chapters: 7, chosung: '미' },
  nah: { ko: '나훔', chapters: 3, chosung: '나' },
  hab: { ko: '하박국', chapters: 3, chosung: '하' },
  zep: { ko: '스바냐', chapters: 3, chosung: '스' },
  hag: { ko: '학개', chapters: 2, chosung: '학' },
  zec: { ko: '스가랴', chapters: 14, chosung: '스' },
  mal: { ko: '말라기', chapters: 4, chosung: '말' },
  mat: { ko: '마태복음', chapters: 28, chosung: '마' },
  mrk: { ko: '마가복음', chapters: 16, chosung: '마' },
  luk: { ko: '누가복음', chapters: 24, chosung: '누' },
  jhn: { ko: '요한복음', chapters: 21, chosung: '요' },
  act: { ko: '사도행전', chapters: 28, chosung: '사' },
  rom: { ko: '로마서', chapters: 16, chosung: '로' },
  co1: { ko: '고린도전서', chapters: 16, chosung: '고' },
  co2: { ko: '고린도후서', chapters: 13, chosung: '고' },
  gal: { ko: '갈라디아서', chapters: 6, chosung: '갈' },
  eph: { ko: '에베소서', chapters: 6, chosung: '에' },
  php: { ko: '빌립보서', chapters: 4, chosung: '빌' },
  col: { ko: '골로새서', chapters: 4, chosung: '골' },
  th1: { ko: '데살로니가전서', chapters: 5, chosung: '데' },
  th2: { ko: '데살로니가후서', chapters: 3, chosung: '데' },
  ti1: { ko: '디모데전서', chapters: 6, chosung: '디' },
  ti2: { ko: '디모데후서', chapters: 4, chosung: '디' },
  tit: { ko: '디도서', chapters: 3, chosung: '디' },
  phm: { ko: '빌레몬서', chapters: 1, chosung: '빌' },
  heb: { ko: '히브리서', chapters: 13, chosung: '히' },
  jam: { ko: '야고보서', chapters: 5, chosung: '야' },
  pe1: { ko: '베드로전서', chapters: 5, chosung: '베' },
  pe2: { ko: '베드로후서', chapters: 3, chosung: '베' },
  jo1: { ko: '요한1서', chapters: 5, chosung: '요' },
  jo2: { ko: '요한2서', chapters: 1, chosung: '요' },
  jo3: { ko: '요한3서', chapters: 1, chosung: '요' },
  jud: { ko: '유다서', chapters: 1, chosung: '유' },
  rev: { ko: '요한계시록', chapters: 22, chosung: '요' },
}

export const BIBLE_VERSIONS = {
  GAE: '개역개정',
  KNT: '새한글',
  WOORI: '우리말성경',
  HAN: '한글KJV',
  SAE: '새번역',
  SAENEW: '새번역개정',
  COG: '공동번역',
  COGNEW: '공동번역개정',
} as const

export type BibleVersion = keyof typeof BIBLE_VERSIONS

export const BIBLE_BOOK_KEYS = Object.keys(BIBLE_BOOKS)

/**
 * Bible book order array for cross-book navigation
 * Maintains canonical order: OT (39 books) + NT (27 books)
 */
export const BIBLE_BOOK_ORDER = [
  'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut',
  'sa1', 'sa2', 'ki1', 'ki2', 'ch1', 'ch2', 'ezr', 'neh',
  'est', 'job', 'psa', 'pro', 'ecc', 'sng', 'isa', 'jer',
  'lam', 'eze', 'dan', 'hos', 'joe', 'amo', 'oba', 'jon',
  'mic', 'nah', 'hab', 'zep', 'hag', 'zec', 'mal',
  'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', 'co1', 'co2',
  'gal', 'eph', 'php', 'col', 'th1', 'th2', 'ti1', 'ti2',
  'tit', 'phm', 'heb', 'jam', 'pe1', 'pe2', 'jo1', 'jo2',
  'jo3', 'jud', 'rev',
] as const

export function isBibleVersion(value: string): value is BibleVersion {
  return value in BIBLE_VERSIONS
}
