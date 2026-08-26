export interface BibleVerseRange {
  readonly start: number;
  readonly end: number;
}

export interface BibleShareLocation {
  readonly book: string;
  readonly chapter: number;
  readonly version: string;
}

export interface BibleSelectionShareInput {
  readonly bookName: string;
  readonly chapter: number;
  readonly chapterSuffix: string;
  readonly verseRange: BibleVerseRange;
  readonly url: string;
}

export interface BibleSelectionShareData {
  readonly title: string;
  readonly url: string;
}

type QueryValue = string | null;
type QueryParam = QueryValue | QueryValue[] | undefined;

const getFirstQueryValue = (value: QueryParam): QueryValue => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const parseVerseRangeParam = (
  value: QueryParam,
): BibleVerseRange | null => {
  const rawValue = getFirstQueryValue(value)?.trim();
  if (!rawValue) return null;

  const match = rawValue.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const [, startValue, endValue] = match;
  if (!startValue) return null;

  const start = Number.parseInt(startValue, 10);
  const end = endValue ? Number.parseInt(endValue, 10) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
    return null;
  }

  return { start, end };
};

export const formatVerseRangeParam = (verseRange: BibleVerseRange): string => (
  verseRange.start === verseRange.end
    ? String(verseRange.start)
    : `${verseRange.start}-${verseRange.end}`
);

export const buildBibleShareUrl = (
  origin: string,
  location: BibleShareLocation,
  verseRange?: BibleVerseRange,
): string => {
  const params = new URLSearchParams();
  params.set('book', location.book);
  params.set('chapter', String(location.chapter));

  if (location.version !== 'GAE') {
    params.set('version', location.version);
  }

  if (verseRange && verseRange.start > 0 && verseRange.end >= verseRange.start) {
    params.set('verse', formatVerseRangeParam(verseRange));
  }

  return `${origin}/bible?${params.toString()}`;
};

export const buildBibleSelectionShareData = (
  input: BibleSelectionShareInput,
): BibleSelectionShareData => {
  const verseLabel = input.verseRange.start === input.verseRange.end
    ? `${input.verseRange.start}절`
    : `${input.verseRange.start}-${input.verseRange.end}절`;

  return {
    title: `${input.bookName} ${input.chapter}${input.chapterSuffix} ${verseLabel}`,
    url: input.url,
  };
};
