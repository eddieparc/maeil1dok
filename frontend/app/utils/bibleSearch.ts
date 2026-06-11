/// <reference lib="es2019" />

export interface BibleSearchBook {
  readonly id: string;
  readonly name: string;
  readonly chapters: number;
}

export interface BibleSearchResult {
  readonly bookId: string;
  readonly chapter: number | null;
  readonly verse: number | null;
  readonly bookName: string;
  readonly maxChapters: number;
}

export interface BibleSearchContext {
  readonly allBooks: readonly BibleSearchBook[];
  readonly aliases: Readonly<Record<string, string>>;
  readonly bookNames: Readonly<Record<string, string>>;
  readonly bookChapters: Readonly<Record<string, number>>;
  readonly getVerseCount: (bookId: string, chapter: number) => number;
}

interface ParsedReference {
  readonly bookQuery: string;
  readonly interpretations: readonly NumberInterpretation[];
}

interface NumberInterpretation {
  readonly chapter: number | null;
  readonly verse: number | null;
}

const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
const CHOSUNG_SET = new Set<string>(CHOSUNG_LIST);

export const extractChosung = (value: string): string => {
  let result = '';

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const chosung = CHOSUNG_LIST[Math.floor((code - 0xac00) / 588)];
      result += chosung ?? '';
    } else if (CHOSUNG_SET.has(char)) {
      result += char;
    }
  }

  return result;
};

export const isChosungOnly = (value: string): boolean => {
  if (value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char || !CHOSUNG_SET.has(char)) return false;
  }
  return true;
};

export const parseBibleSearchQuery = (
  query: string,
  context: BibleSearchContext,
): BibleSearchResult[] => {
  const parsed = parseReference(query);
  if (!parsed) return [];

  const matchedBookIds = findMatchingBookIds(parsed.bookQuery, context);
  const results: BibleSearchResult[] = [];

  for (const bookId of matchedBookIds) {
    const maxChapters = context.bookChapters[bookId] ?? 1;
    const bookName = context.bookNames[bookId] ?? bookId;

    for (const interpretation of parsed.interpretations) {
      if (!isValidInterpretation(bookId, maxChapters, interpretation, context)) continue;
      if (hasDuplicate(results, bookId, interpretation)) continue;

      results.push({
        bookId,
        chapter: interpretation.chapter,
        verse: interpretation.verse,
        bookName,
        maxChapters,
      });
    }
  }

  return sortResults(results, parsed.bookQuery, context);
};

const parseReference = (query: string): ParsedReference | null => {
  const normalized = normalizeQuery(query);
  if (normalized.length === 0) return null;

  const englishReference = normalized.match(/^([1-3]?[a-z]+)\s*(\d+)?(?:\s*(?:장|편)?\s*[:\s]\s*(\d+)\s*절?)?$/i);
  if (englishReference?.[1]) {
    return {
      bookQuery: englishReference[1].toLowerCase(),
      interpretations: buildInterpretations(englishReference[2] ?? '', englishReference[3] ?? '', hasExplicitVerseSeparator(normalized)),
    };
  }

  const firstNumberIndex = normalized.search(/\d/);
  if (firstNumberIndex < 0) {
    return { bookQuery: cleanupBookQuery(normalized), interpretations: [{ chapter: null, verse: null }] };
  }

  const bookQuery = cleanupBookQuery(normalized.slice(0, firstNumberIndex));
  if (bookQuery.length === 0) return null;

  const numbers = normalized.slice(firstNumberIndex).match(/\d+/g) ?? [];
  return {
    bookQuery,
    interpretations: buildInterpretations(numbers[0] ?? '', numbers[1] ?? '', hasExplicitVerseSeparator(normalized)),
  };
};

const buildInterpretations = (
  chapterText: string,
  verseText: string,
  hasVerseSeparator: boolean,
): readonly NumberInterpretation[] => {
  if (chapterText.length === 0) return [{ chapter: null, verse: null }];

  const chapter = parseInt(chapterText, 10);
  if (!Number.isInteger(chapter)) return [];

  if (verseText.length > 0) {
    const verse = parseInt(verseText, 10);
    return Number.isInteger(verse) ? [{ chapter, verse }] : [];
  }

  const interpretations: NumberInterpretation[] = [{ chapter, verse: null }];
  if (!hasVerseSeparator && chapterText.length >= 3) {
    interpretations.push({
      chapter: parseInt(chapterText.slice(0, 1), 10),
      verse: parseInt(chapterText.slice(1), 10),
    });
    interpretations.push({
      chapter: parseInt(chapterText.slice(0, 2), 10),
      verse: parseInt(chapterText.slice(2), 10),
    });
  }

  return interpretations;
};

const findMatchingBookIds = (
  rawBookQuery: string,
  context: BibleSearchContext,
): readonly string[] => {
  const bookQuery = cleanupBookQuery(rawBookQuery);
  const compactQuery = compact(bookQuery);
  const matchedBookIds = new Set<string>();

  if (isChosungOnly(compactQuery)) {
    for (const book of context.allBooks) {
      const bookChosung = extractChosung(book.name);
      if (bookChosung.startsWith(compactQuery)) matchedBookIds.add(book.id);
    }

    for (const [alias, bookId] of Object.entries(context.aliases)) {
      const aliasChosung = extractChosung(alias);
      if (aliasChosung.startsWith(compactQuery)) matchedBookIds.add(bookId);
    }
  }

  const aliasMatch = context.aliases[compactQuery];
  if (aliasMatch) matchedBookIds.add(aliasMatch);

  for (const book of context.allBooks) {
    const bookName = compact(book.name);
    if (book.id.toLowerCase() === compactQuery || bookName.startsWith(compactQuery) || bookName.includes(compactQuery)) {
      matchedBookIds.add(book.id);
    }
  }

  for (const [alias, bookId] of Object.entries(context.aliases)) {
    const compactAlias = compact(alias);
    if (compactAlias.startsWith(compactQuery) || compactQuery.startsWith(compactAlias)) {
      matchedBookIds.add(bookId);
    }
  }

  const matches: string[] = [];
  matchedBookIds.forEach((bookId) => {
    matches.push(bookId);
  });
  return matches;
};

const isValidInterpretation = (
  bookId: string,
  maxChapters: number,
  interpretation: NumberInterpretation,
  context: BibleSearchContext,
): boolean => {
  if (interpretation.chapter === null) return true;
  if (interpretation.chapter < 1 || interpretation.chapter > maxChapters) return false;
  if (interpretation.verse === null) return true;
  if (interpretation.verse < 1) return false;

  const maxVerse = context.getVerseCount(bookId, interpretation.chapter);
  return maxVerse > 0 && interpretation.verse <= maxVerse;
};

const hasDuplicate = (
  results: readonly BibleSearchResult[],
  bookId: string,
  interpretation: NumberInterpretation,
): boolean => {
  return results.some(
    (result) => result.bookId === bookId && result.chapter === interpretation.chapter && result.verse === interpretation.verse,
  );
};

const sortResults = (
  results: readonly BibleSearchResult[],
  bookQuery: string,
  context: BibleSearchContext,
): BibleSearchResult[] => {
  const compactQuery = compact(bookQuery);
  const bookOrder = context.allBooks.map((book) => book.id);

  return [...results].sort((left, right) => {
    const leftExact = isExactBookMatch(left, compactQuery, context);
    const rightExact = isExactBookMatch(right, compactQuery, context);
    if (leftExact && !rightExact) return -1;
    if (!leftExact && rightExact) return 1;

    return bookOrder.indexOf(left.bookId) - bookOrder.indexOf(right.bookId);
  });
};

const isExactBookMatch = (
  result: BibleSearchResult,
  compactQuery: string,
  context: BibleSearchContext,
): boolean => {
  const name = context.bookNames[result.bookId] ?? result.bookName;
  return compact(name) === compactQuery ||
    context.aliases[compactQuery] === result.bookId ||
    (isChosungOnly(compactQuery) && extractChosung(name) === compactQuery);
};

const normalizeQuery = (query: string): string => {
  return query
    .trim()
    .toLowerCase()
    .replace(/[：]/g, ':')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ');
};

const cleanupBookQuery = (query: string): string => {
  return compact(query.replace(/[장편절:：]+$/g, ''));
};

const compact = (value: string): string => {
  return value.replace(/\s+/g, '').toLowerCase();
};

const hasExplicitVerseSeparator = (value: string): boolean => {
  return /[:：]|절/.test(value);
};
