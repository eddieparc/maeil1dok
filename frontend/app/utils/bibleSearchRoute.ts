export interface BibleSearchResultLocation {
  readonly version: string;
  readonly book: string;
  readonly chapter: number;
  readonly verse?: number | null;
}

type QueryValue = string | null;
type QueryParam = QueryValue | QueryValue[] | undefined;

export const buildBibleSearchResultQuery = (
  result: BibleSearchResultLocation,
  searchTerm: string,
) => ({
  book: result.book,
  chapter: String(result.chapter),
  version: result.version,
  verse: result.verse ? String(result.verse) : undefined,
  search: searchTerm,
});

export const parseSearchFocusParam = (value: QueryParam): string | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue?.trim();
  return normalized || null;
};
