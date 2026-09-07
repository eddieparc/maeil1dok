import type { PreparedCertificationImage } from '~/composables/useCertificationShare';

export type BibleShareCategory = 'story' | 'feed';
export type BibleShareTheme = 'light' | 'dark';
export interface BibleShareVerse {
  readonly id: string;
  readonly text: string;
  readonly reference: string;
}
export interface BibleShareMetadata {
  readonly dateLabel?: string;
  readonly nickname?: string;
  readonly planName?: string;
  readonly readingRange?: string;
  readonly streak?: number;
  readonly progress?: { readonly completed: number; readonly total: number; readonly percent: number };
}
export interface BibleShareInput {
  readonly mode: 'verse' | 'complete';
  readonly metadata: BibleShareMetadata;
  /** In verse mode pass the selected verse first. Completion highlights must be in the actual schedule. */
  readonly verses: readonly BibleShareVerse[];
}
export interface BibleShareSlide {
  readonly id: string;
  readonly kind: 'summary' | 'streak' | 'verse' | 'feed';
  readonly label: string;
  readonly verse?: BibleShareVerse;
}
export interface BibleShareAssets { readonly logo: string; readonly fontCss: string }
export interface ShareSheetProps extends BibleShareInput {
  modelValue: boolean;
  loading?: boolean;
  /** Verse URL or certification history URL, supplied by the context owner. */
  shareUrl?: string;
  planId?: number | null;
  scheduleId?: number | null;
}
export const buildBibleShareSlides = (input: BibleShareInput, category: BibleShareCategory): BibleShareSlide[] => {
  const verses = (input.mode === 'verse' ? input.verses.slice(0, 1) : input.verses)
    .filter(verse => verse.text.trim())
    .map(verse => ({ id: `verse:${verse.id}`, kind: 'verse' as const, label: verse.reference, verse }));
  if (input.mode === 'verse') return verses;
  const summary: BibleShareSlide = { id: 'summary', kind: 'summary', label: '오늘 완료' };
  const streak: BibleShareSlide[] = Number.isInteger(input.metadata.streak) && input.metadata.streak! > 0
    ? [{ id: 'streak', kind: category === 'story' ? 'streak' : 'feed', label: `연속 ${input.metadata.streak}일` }]
    : [];
  return category === 'story' ? [summary, ...streak, ...verses] : [...streak, summary, ...verses];
};

/** Plain state is wrapped in reactive() by the sheet; callers can also use it without Vue. */
export const createBibleShareState = (input: BibleShareInput) => ({
  input,
  category: 'story' as BibleShareCategory,
  index: 0,
  theme: 'light' as BibleShareTheme,
  get slides(): BibleShareSlide[] { return buildBibleShareSlides(this.input, this.category); },
  get themeEligible(): boolean { return ['verse', 'summary'].includes(this.slides[this.index]?.kind ?? ''); },
  setCategory(category: BibleShareCategory) { this.category = category; this.index = 0; },
  select(index: number) { this.index = Math.max(0, Math.min(this.slides.length - 1, Math.round(index))); },
});

// Conservative full-em wrapping is deterministic in preview and export, including
// Korean and surrogate pairs. Reduce size rather than silently truncating Scripture.
export const layoutShareText = (text: string, width: number, height: number, preferredSize: number) => {
  const characters = Array.from(text);
  let fontSize = preferredSize;
  let lines: string[] = [];
  do {
    const columns = Math.max(1, Math.floor(width / fontSize));
    lines = [];
    for (let i = 0; i < characters.length; i += columns) lines.push(characters.slice(i, i + columns).join(''));
    if (lines.length * fontSize * 1.44 <= height) break;
    fontSize -= 0.5;
  } while (fontSize > 0.5);
  return { fontSize, lines };
};

export const sharePalette = (theme: BibleShareTheme) => theme === 'dark'
  ? { background: '#2A1111', text: '#FFFFFF', secondary: '#CEC6C6', track: '#543F3F' }
  : { background: '#FAF8F5', text: '#1F1A17', secondary: '#6B625B', track: '#E9E4DE' };

const blobDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error('공유 리소스를 읽지 못했습니다.'));
  reader.readAsDataURL(blob);
});
let assetsPromise: Promise<BibleShareAssets> | undefined;
export const loadBibleShareAssets = (): Promise<BibleShareAssets> => {
  if (!assetsPromise) {
    const fetchBlob = async (url: string) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('공유 글꼴 또는 로고를 불러오지 못했습니다.');
      return response.blob();
    };
    assetsPromise = Promise.all([
      fetchBlob('/images/logo-transparent.png').then(blobDataUrl),
      ...[['Light', 400], ['Regular', 500], ['Bold', 600]].map(async ([name, weight]) => {
        const blob = await fetchBlob(`https://cdn.jsdelivr.net/npm/@noonnu/kopub-batang@0.0.1/KoPubBatang-${name}.woff2`);
        const url = await blobDataUrl(blob);
        // The SVG embeds these bytes, while this face makes the live preview ready too.
        const face = await new FontFace('ShareKoPub', await blob.arrayBuffer(), { weight: String(weight) }).load();
        document.fonts.add(face);
        return `@font-face{font-family:ShareKoPub;src:url("${url}") format("woff2");font-weight:${weight};}`;
      }),
    ]).then(([logo, ...fonts]) => ({ logo: logo!, fontCss: fonts.join('') })).catch(error => {
      assetsPromise = undefined;
      throw error;
    });
  }
  return assetsPromise;
};

/** Serialize the mounted Vue SVG, never recreate its artwork in canvas commands. */
export const serializeBibleShareSvg = (svg: SVGSVGElement): string => {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.removeAttribute('class');
  copy.removeAttribute('style');
  return new XMLSerializer().serializeToString(copy);
};

/** Fixed 2x export: story 720x1280, feed 720x720 (360px design width). */
export const prepareBibleShareImage = async (svg: SVGSVGElement): Promise<PreparedCertificationImage> => {
  await document.fonts.ready;
  const source = serializeBibleShareSvg(svg);
  const { width, height } = svg.viewBox.baseVal;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('공유 이미지 캔버스를 열지 못했습니다.');
  const image = new Image();
  // Data URLs keep all embedded SVG resources available in WebKit image mode.
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('공유 카드를 이미지로 변환하지 못했습니다.'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  await loaded;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value
    ? resolve(value) : reject(new Error('PNG 이미지를 만들지 못했습니다.')), 'image/png'));
  return { file: new File([blob], 'maeil1dok-tongdok-certification.png', { type: 'image/png' }), dataUrl, width: canvas.width, height: canvas.height };
};

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
