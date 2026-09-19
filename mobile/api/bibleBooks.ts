/**
 * bibleBooks — 성경 66권 메타데이터 (순수 모듈, test target).
 *
 * frontend/app/composables/useBibleData.ts 의 BIBLE_BOOKS 를 그대로 이식.
 * 네이티브 화면(홈/성경/통독표)이 공유하는 단일 원천.
 */

export interface BibleBook {
  readonly id: string;
  readonly name: string;
  readonly chapters: number;
  readonly testament: 'old' | 'new';
}

const OLD: ReadonlyArray<readonly [string, string, number]> = [
  ['gen', '창세기', 50], ['exo', '출애굽기', 40], ['lev', '레위기', 27],
  ['num', '민수기', 36], ['deu', '신명기', 34], ['jos', '여호수아', 24],
  ['jdg', '사사기', 21], ['rut', '룻기', 4], ['1sa', '사무엘상', 31],
  ['2sa', '사무엘하', 24], ['1ki', '열왕기상', 22], ['2ki', '열왕기하', 25],
  ['1ch', '역대상', 29], ['2ch', '역대하', 36], ['ezr', '에스라', 10],
  ['neh', '느헤미야', 13], ['est', '에스더', 10], ['job', '욥기', 42],
  ['psa', '시편', 150], ['pro', '잠언', 31], ['ecc', '전도서', 12],
  ['sng', '아가', 8], ['isa', '이사야', 66], ['jer', '예레미야', 52],
  ['lam', '예레미야애가', 5], ['ezk', '에스겔', 48], ['dan', '다니엘', 12],
  ['hos', '호세아', 14], ['jol', '요엘', 3], ['amo', '아모스', 9],
  ['oba', '오바댜', 1], ['jnh', '요나', 4], ['mic', '미가', 7],
  ['nam', '나훔', 3], ['hab', '하박국', 3], ['zep', '스바냐', 3],
  ['hag', '학개', 2], ['zec', '스가랴', 14], ['mal', '말라기', 4],
];

const NEW: ReadonlyArray<readonly [string, string, number]> = [
  ['mat', '마태복음', 28], ['mrk', '마가복음', 16], ['luk', '누가복음', 24],
  ['jhn', '요한복음', 21], ['act', '사도행전', 28], ['rom', '로마서', 16],
  ['1co', '고린도전서', 16], ['2co', '고린도후서', 13], ['gal', '갈라디아서', 6],
  ['eph', '에베소서', 6], ['php', '빌립보서', 4], ['col', '골로새서', 4],
  ['1th', '데살로니가전서', 5], ['2th', '데살로니가후서', 3],
  ['1ti', '디모데전서', 6], ['2ti', '디모데후서', 4], ['tit', '디도서', 3],
  ['phm', '빌레몬서', 1], ['heb', '히브리서', 13], ['jas', '야고보서', 5],
  ['1pe', '베드로전서', 5], ['2pe', '베드로후서', 3], ['1jn', '요한일서', 5],
  ['2jn', '요한이서', 1], ['3jn', '요한삼서', 1], ['jud', '유다서', 1],
  ['rev', '요한계시록', 22],
];

export const BIBLE_BOOKS: readonly BibleBook[] = [
  ...OLD.map(([id, name, chapters]) => ({ id, name, chapters, testament: 'old' as const })),
  ...NEW.map(([id, name, chapters]) => ({ id, name, chapters, testament: 'new' as const })),
];

const BY_ID = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));

export const isBibleBook = (id: string | null | undefined): boolean =>
  typeof id === 'string' && BY_ID.has(id);

export const bookName = (id: string | null | undefined): string =>
  (typeof id === 'string' ? BY_ID.get(id)?.name : undefined) ?? id ?? '';

export const chapterCount = (id: string | null | undefined): number =>
  (typeof id === 'string' ? BY_ID.get(id)?.chapters : undefined) ?? 0;

/** 시편은 '편', 나머지는 '장'. */
export const chapterUnit = (id: string | null | undefined): string =>
  id === 'psa' ? '편' : '장';

/** '창세기 1장' / '시편 23편' 형태 라벨. */
export const chapterLabel = (id: string | null | undefined, chapter: number): string =>
  `${bookName(id)} ${chapter}${chapterUnit(id)}`;

/** 범위 라벨: 같은 책이면 '창세기 1-3장', 아니면 '창세기 1장-출애굽기 2장'. */
export const rangeLabel = (
  book: string,
  startChapter: number,
  endChapter: number,
): string => {
  const unit = chapterUnit(book);
  if (startChapter === endChapter) return `${bookName(book)} ${startChapter}${unit}`;
  return `${bookName(book)} ${startChapter}-${endChapter}${unit}`;
};

export interface ChapterRef {
  readonly book: string;
  readonly chapter: number;
}

/** 다음 장 위치. 책 끝이면 다음 책 1장, 마지막이면 null. */
export const nextChapter = (ref: ChapterRef): ChapterRef | null => {
  const book = BY_ID.get(ref.book);
  if (!book) return null;
  if (ref.chapter < book.chapters) return { book: ref.book, chapter: ref.chapter + 1 };
  const idx = BIBLE_BOOKS.indexOf(book);
  const next = BIBLE_BOOKS[idx + 1];
  return next ? { book: next.id, chapter: 1 } : null;
};

/** 이전 장 위치. 첫 장이면 이전 책 마지막 장, 처음이면 null. */
export const prevChapter = (ref: ChapterRef): ChapterRef | null => {
  const book = BY_ID.get(ref.book);
  if (!book) return null;
  if (ref.chapter > 1) return { book: ref.book, chapter: ref.chapter - 1 };
  const idx = BIBLE_BOOKS.indexOf(book);
  const prev = BIBLE_BOOKS[idx - 1];
  return prev ? { book: prev.id, chapter: prev.chapters } : null;
};
