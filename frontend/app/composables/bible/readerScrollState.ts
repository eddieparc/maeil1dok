export interface ReaderScrollState {
  readonly scrollPosition: number;
  readonly hasReaderScrollPosition: boolean;
}

export interface ReaderLocation {
  readonly book: string;
  readonly chapter: number;
  readonly version: string;
}

export interface ReadingPositionSaveCommand extends ReaderLocation {
  readonly immediate: boolean;
  readonly explicitScrollPosition: number | undefined;
}

export interface BibleRouteQuery {
  readonly book?: unknown;
  readonly chapter?: unknown;
  readonly verse?: unknown;
  readonly plan?: unknown;
  readonly tongdok?: unknown;
}

export interface BibleRouteQueryPolicy {
  readonly hasBibleLocationQuery: boolean;
  readonly shouldInitializeOnEntry: boolean;
  readonly shouldReloadReader: boolean;
}

export const setReaderScrollState = (
  position: number,
  fromReaderScroll = false,
): ReaderScrollState => ({
  scrollPosition: position,
  hasReaderScrollPosition: fromReaderScroll,
});

export const resetReaderScrollState = (): ReaderScrollState =>
  setReaderScrollState(0);

export const getExplicitReaderScrollPosition = (
  state: ReaderScrollState,
): number | undefined => (
  state.hasReaderScrollPosition ? state.scrollPosition : undefined
);

export const buildReadingPositionSaveCommand = (
  location: ReaderLocation,
  immediate: boolean,
  explicitScrollPosition: number | undefined,
): ReadingPositionSaveCommand => ({
  ...location,
  immediate,
  explicitScrollPosition,
});

export const getBibleRouteQueryPolicy = (
  query: BibleRouteQuery,
): BibleRouteQueryPolicy => {
  const hasBibleLocationQuery = Boolean(query.book || query.chapter || query.verse);

  return {
    hasBibleLocationQuery,
    shouldInitializeOnEntry: Boolean(
      hasBibleLocationQuery || query.plan || query.tongdok,
    ),
    shouldReloadReader: Boolean(hasBibleLocationQuery || query.tongdok),
  };
};
