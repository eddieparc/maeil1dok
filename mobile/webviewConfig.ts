export const DEFAULT_LEGACY_WEB_APP_URL = 'https://maeil1dok.app/';

const DEFAULT_ROLLOUT_PERCENT = 0;
const HASH_OFFSET_BASIS = 2166136261;
const HASH_PRIME = 16777619;
const BUCKET_COUNT = 100;

export type WebViewTarget = 'legacy' | 'next' | 'percent';

export type RawWebViewConfig = {
  readonly webviewTarget?: unknown;
  readonly webviewNextPercent?: unknown;
  readonly webviewNextUrl?: unknown;
  readonly webviewLegacyUrl?: unknown;
  readonly webviewKillSwitch?: unknown;
  readonly webviewInstallId?: unknown;
};

export type ResolvedWebViewConfig = {
  readonly webAppUrl: string;
  readonly selectedTarget: 'legacy' | 'next';
  readonly rolloutPercent: number;
  readonly rolloutBucket: number | null;
};

const normalizeUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.toString();
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
};

const normalizeTarget = (value: unknown): WebViewTarget => {
  switch (value) {
    case 'next':
      return 'next';
    case 'percent':
      return 'percent';
    case 'legacy':
    default:
      return 'legacy';
  }
};

const normalizePercent = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > BUCKET_COUNT) {
    return DEFAULT_ROLLOUT_PERCENT;
  }
  return Math.trunc(parsed);
};

const normalizeInstallId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeKillSwitch = (value: unknown): boolean => (
  value === true || value === 'true' || value === '1'
);

export const getStableBucket = (installId: string): number => {
  let hash = HASH_OFFSET_BASIS;
  for (let index = 0; index < installId.length; index += 1) {
    hash ^= installId.charCodeAt(index);
    hash = Math.imul(hash, HASH_PRIME);
  }
  return Math.abs(hash) % BUCKET_COUNT;
};

export const resolveWebViewConfig = (rawConfig: RawWebViewConfig): ResolvedWebViewConfig => {
  const legacyUrl = normalizeUrl(rawConfig.webviewLegacyUrl) ?? DEFAULT_LEGACY_WEB_APP_URL;
  const nextUrl = normalizeUrl(rawConfig.webviewNextUrl);
  const rolloutPercent = normalizePercent(rawConfig.webviewNextPercent);
  const installId = normalizeInstallId(rawConfig.webviewInstallId);
  const rolloutBucket = installId ? getStableBucket(installId) : null;
  const target = normalizeTarget(rawConfig.webviewTarget);

  if (normalizeKillSwitch(rawConfig.webviewKillSwitch) || !nextUrl) {
    return {
      webAppUrl: legacyUrl,
      selectedTarget: 'legacy',
      rolloutPercent,
      rolloutBucket,
    };
  }

  if (target === 'next') {
    return {
      webAppUrl: nextUrl,
      selectedTarget: 'next',
      rolloutPercent,
      rolloutBucket,
    };
  }

  if (target === 'percent' && rolloutBucket !== null && rolloutBucket < rolloutPercent) {
    return {
      webAppUrl: nextUrl,
      selectedTarget: 'next',
      rolloutPercent,
      rolloutBucket,
    };
  }

  return {
    webAppUrl: legacyUrl,
    selectedTarget: 'legacy',
    rolloutPercent,
    rolloutBucket,
  };
};
