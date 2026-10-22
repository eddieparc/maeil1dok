/**
 * 읽기 설정 모델 — 웹 스토어(stores/readingSettings.ts)와 동일한 계약.
 *
 * 서버는 snake_case(`GET/PATCH /api/v1/auth/reading-settings/`), 로컬 저장은
 * camelCase JSON을 쓴다. 두 형태 모두 `parseReadingSettings`가 경계에서
 * 파싱해 `ReadingSettings`로 만든다 — 범위 밖 숫자·알 수 없는 enum·truthy
 * 문자열은 기본값으로 되돌리고, 모델 안에서는 재검증하지 않는다.
 *
 * 폰트: 웹의 5개 지정 family를 원본 글꼴로 번들한다.
 * `resolveNativeFontFamily`는 등록된 face 이름을, system은 null을 돌려준다.
 * RIDI는 원본 400 face만 제공하므로 모든 굵기에서 그 face를 사용한다.
 * 출처·웹 굵기와 원본 굵기의 차이는 assets/fonts/README.md에 기록한다.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontFamily = 'ridi-batang' | 'noto-serif' | 'kopub-batang' | 'pretendard' | 'noto-sans' | 'system';
export type FontWeight = 'normal' | 'medium' | 'bold';
export type TextAlign = 'left' | 'justify';

export interface ReadingSettings {
  readonly theme: ThemeMode;
  readonly fontFamily: FontFamily;
  readonly fontSize: number;
  readonly fontWeight: FontWeight;
  readonly lineHeight: number;
  readonly textAlign: TextAlign;
  readonly verseJoining: boolean;
  readonly showVerseNumbers: boolean;
  readonly tongdokAutoComplete: boolean;
  readonly audioPlaybackRate: number;
  readonly showDescription: boolean;
  readonly showCrossRef: boolean;
  readonly highlightNames: boolean;
  readonly showFootnotes: boolean;
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  theme: 'light',
  fontFamily: 'kopub-batang',
  fontSize: 16,
  fontWeight: 'medium',
  lineHeight: 1.6,
  textAlign: 'left',
  verseJoining: false,
  showVerseNumbers: true,
  tongdokAutoComplete: false,
  audioPlaybackRate: 1.0,
  showDescription: true,
  showCrossRef: true,
  highlightNames: true,
  showFootnotes: false,
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 24;
export const LINE_HEIGHT_MIN = 1.4;
export const LINE_HEIGHT_MAX = 2.4;
export const AUDIO_RATE_MIN = 0.5;
export const AUDIO_RATE_MAX = 2.0;

export const FONT_WEIGHTS: Record<FontWeight, number> = {
  normal: 400,
  medium: 500,
  bold: 600,
};

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
const FONT_FAMILIES: readonly FontFamily[] = ['ridi-batang', 'noto-serif', 'kopub-batang', 'pretendard', 'noto-sans', 'system'];
const FONT_WEIGHT_KEYS: readonly FontWeight[] = ['normal', 'medium', 'bold'];
const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'justify'];

/** 웹 마이그레이션과 동일한 구형 문자열 줄간격 값. */
const LEGACY_LINE_HEIGHTS: Record<string, number> = {
  compact: 1.5,
  normal: 1.8,
  wide: 2.2,
};

interface NativeFontMeta {
  readonly label: string;
  readonly bundled: boolean;
  /** weight → expo-font 등록 이름. 단일 face인 RIDI는 normal을 사용한다. */
  readonly fonts: Readonly<Partial<Record<FontWeight, string>>>;
}

export const NATIVE_FONT_META: Record<FontFamily, NativeFontMeta> = {
  'kopub-batang': {
    label: 'KoPub 바탕',
    bundled: true,
    // 웹 CSS 400/500/600은 원본 Light(300)/Regular(400)/Bold(700)에 대응한다.
    fonts: { normal: 'KoPubBatang-Light', medium: 'KoPubBatang-Regular', bold: 'KoPubBatang-Bold' },
  },
  'ridi-batang': {
    label: 'RIDI 바탕',
    bundled: true,
    fonts: { normal: 'RIDIBatang' },
  },
  'noto-serif': {
    label: 'Noto Serif KR',
    bundled: true,
    fonts: { normal: 'NotoSerifKR-Regular', medium: 'NotoSerifKR-Medium', bold: 'NotoSerifKR-SemiBold' },
  },
  'pretendard': {
    label: 'Pretendard',
    bundled: true,
    fonts: { normal: 'Pretendard-Regular', medium: 'Pretendard-Medium', bold: 'Pretendard-SemiBold' },
  },
  'noto-sans': {
    label: 'Noto Sans KR',
    bundled: true,
    fonts: { normal: 'NotoSansKR-Regular', medium: 'NotoSansKR-Medium', bold: 'NotoSansKR-SemiBold' },
  },
  'system': { label: '시스템 기본', bundled: true, fonts: {} },
};

/** 웹 읽기 설정과 동일한 표시 순서. */
export const NATIVE_FONT_ORDER: readonly FontFamily[] = [
  'kopub-batang', 'ridi-batang', 'noto-serif', 'pretendard', 'noto-sans', 'system',
];

/** 지정 family는 등록된 face를, system은 null(RN 기본 폰트)을 돌려준다. */
export const resolveNativeFontFamily = (family: FontFamily, weight: FontWeight): string | null => {
  const meta = NATIVE_FONT_META[family];
  if (!meta.bundled) return null;
  return meta.fonts[weight] ?? meta.fonts.normal ?? null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pick = (raw: Record<string, unknown>, snake: string, camel: string): unknown =>
  raw[snake] !== undefined ? raw[snake] : raw[camel];

const parseEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const found = allowed.find((candidate) => candidate === value);
  return found !== undefined ? found : fallback;
};

const parseBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const parseIntInRange = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : fallback;
};

const parseFloatInRange = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value >= min && value <= max ? value : fallback;
};

const parseLineHeight = (value: unknown, fallback: number): number => {
  if (typeof value === 'string') {
    const legacy = LEGACY_LINE_HEIGHTS[value];
    return legacy !== undefined ? legacy : fallback;
  }
  // UI 스텝이 0.1이라 부동소수점 잔여를 한 자리로 정규화한다.
  const parsed = parseFloatInRange(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, fallback);
  return parsed === fallback ? fallback : Math.round(parsed * 10) / 10;
};

/** snake_case(서버)·camelCase(로컬 저장) 어느 쪽이든 파싱해 완전한 모델을 돌려준다. */
export const parseReadingSettings = (input: unknown): ReadingSettings => {
  if (!isRecord(input)) return DEFAULT_READING_SETTINGS;
  const d = DEFAULT_READING_SETTINGS;
  return {
    theme: parseEnum(pick(input, 'theme', 'theme'), THEME_MODES, d.theme),
    fontFamily: parseEnum(pick(input, 'font_family', 'fontFamily'), FONT_FAMILIES, d.fontFamily),
    fontSize: parseIntInRange(pick(input, 'font_size', 'fontSize'), FONT_SIZE_MIN, FONT_SIZE_MAX, d.fontSize),
    fontWeight: parseEnum(pick(input, 'font_weight', 'fontWeight'), FONT_WEIGHT_KEYS, d.fontWeight),
    lineHeight: parseLineHeight(pick(input, 'line_height', 'lineHeight'), d.lineHeight),
    textAlign: parseEnum(pick(input, 'text_align', 'textAlign'), TEXT_ALIGNS, d.textAlign),
    verseJoining: parseBool(pick(input, 'verse_joining', 'verseJoining'), d.verseJoining),
    showVerseNumbers: parseBool(pick(input, 'show_verse_numbers', 'showVerseNumbers'), d.showVerseNumbers),
    tongdokAutoComplete: parseBool(pick(input, 'tongdok_auto_complete', 'tongdokAutoComplete'), d.tongdokAutoComplete),
    audioPlaybackRate: parseFloatInRange(pick(input, 'audio_playback_rate', 'audioPlaybackRate'), AUDIO_RATE_MIN, AUDIO_RATE_MAX, d.audioPlaybackRate),
    showDescription: parseBool(pick(input, 'show_description', 'showDescription'), d.showDescription),
    showCrossRef: parseBool(pick(input, 'show_cross_ref', 'showCrossRef'), d.showCrossRef),
    highlightNames: parseBool(pick(input, 'highlight_names', 'highlightNames'), d.highlightNames),
    showFootnotes: parseBool(pick(input, 'show_footnotes', 'showFootnotes'), d.showFootnotes),
  };
};

/** PATCH /api/v1/auth/reading-settings/update/ 바디 (snake_case). */
export const serializeReadingSettingsPatch = (settings: ReadingSettings): Record<string, unknown> => ({
  theme: settings.theme,
  font_family: settings.fontFamily,
  font_size: settings.fontSize,
  font_weight: settings.fontWeight,
  line_height: settings.lineHeight,
  text_align: settings.textAlign,
  verse_joining: settings.verseJoining,
  show_verse_numbers: settings.showVerseNumbers,
  tongdok_auto_complete: settings.tongdokAutoComplete,
  audio_playback_rate: settings.audioPlaybackRate,
  show_description: settings.showDescription,
  show_cross_ref: settings.showCrossRef,
  highlight_names: settings.highlightNames,
  show_footnotes: settings.showFootnotes,
});

/** StandardResponse `{ success, data: { settings } }` 봉투를 벗겨 파싱한다. */
export const parseReadingSettingsResponse = (body: unknown): ReadingSettings | null => {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null;
  if (!isRecord(body.data.settings)) return null;
  return parseReadingSettings(body.data.settings);
};

/** AsyncStorage에 저장된 JSON 문자열을 파싱한다. 깨진 값은 null. */
export const parseStoredReadingSettings = (raw: string | null): ReadingSettings | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parseReadingSettings(parsed) : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
};
