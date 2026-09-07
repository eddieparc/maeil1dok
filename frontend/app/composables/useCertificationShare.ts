export type CertificationShareResult = 'shared' | 'downloaded' | 'copied';
export interface PreparedCertificationImage {
  readonly file: File;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}
type CertificationImageAction = 'share' | 'save';

export interface CertificationSharePayload {
  /** Prepared before the user tap; no asynchronous rendering in native transport. */
  preparedImage?: PreparedCertificationImage;
  shareUrl?: string;
  title?: string;
  subtitle?: string;
  readingRange?: string;
  dateLabel?: string;
  footer?: string;
  planName?: string;
  planId?: number | null;
  scheduleId?: number | null;
  progressLine?: string;
}

export interface CertificationProgressPayload {
  success: boolean;
  user?: {
    id: number;
    nickname: string;
  };
  plan?: {
    id: number;
    name: string;
  };
  progress?: {
    totalSchedules: number;
    completedSchedules: number;
    completionRate: number;
    currentStreak: number;
    totalCompletedDays: number;
    latestCompletedAt: string | null;
    status: 'no_progress' | 'in_progress' | 'completed';
  };
  card?: CertificationSharePayload;
}

class CertificationImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificationImageError';
  }
}

const FILE_NAME = 'maeil1dok-tongdok-certification.png';
const SHARE_TITLE = '매일일독 통독 인증 카드';
const SHARE_TEXT = '오늘도 말씀을 읽었습니다';
const getCertificationLink = (payload?: CertificationSharePayload): string => {
  if (payload?.shareUrl) return payload.shareUrl;
  const path = '/bible/history';
  const origin = typeof window === 'undefined' ? 'https://maeil1dok.app' : window.location.origin;
  const url = new URL(path, origin);
  if (payload?.planId) {
    url.searchParams.set('plan_id', payload.planId.toString());
  }
  if (payload?.scheduleId) {
    url.searchParams.set('schedule_id', payload.scheduleId.toString());
  }
  if (payload?.dateLabel) {
    url.searchParams.set('date', payload.dateLabel);
  }
  url.searchParams.set('certification', 'tongdok');
  return url.toString();
};

const requirePreparedImage = (payload?: CertificationSharePayload): PreparedCertificationImage => {
  if (!payload?.preparedImage) throw new CertificationImageError('공유 카드 이미지가 아직 준비되지 않았습니다.');
  return payload.preparedImage;
};

const isAndroidNativeWebView = (): boolean => (
  typeof window !== 'undefined'
  && 'isReactNativeWebView' in window
  && window.isReactNativeWebView === true
  && 'isAndroidApp' in window
  && window.isAndroidApp === true
);

const isIosNativeWebView = (): boolean => (
  typeof window !== 'undefined'
  && 'isReactNativeWebView' in window
  && window.isReactNativeWebView === true
  && (!('isAndroidApp' in window) || window.isAndroidApp !== true)
);

const postAndroidCertificationImage = (
  action: CertificationImageAction,
  payload?: CertificationSharePayload,
): boolean => {
  if (!isAndroidNativeWebView()) {
    return false;
  }

  const bridge = Reflect.get(window, 'ReactNativeWebView');
  if (typeof bridge !== 'object' || bridge === null) {
    throw new CertificationImageError('Android 앱 이미지 브리지를 찾을 수 없습니다.');
  }
  const postMessage = Reflect.get(bridge, 'postMessage');
  if (typeof postMessage !== 'function') {
    throw new CertificationImageError('Android 앱 이미지 브리지를 사용할 수 없습니다.');
  }

  const dataUrl = requirePreparedImage(payload).dataUrl;
  Reflect.apply(postMessage, bridge, [JSON.stringify({
    type: 'certification:image',
    action,
    fileName: FILE_NAME,
    dataUrl,
  })]);
  return true;
};

const shareCertificationFile = async (file: File): Promise<void> => {
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
    throw new CertificationImageError('이 기기에서는 인증 카드 이미지를 공유할 수 없습니다.');
  }
  await navigator.share({ files: [file] });
};

export const useCertificationShare = () => {
  const shareCertification = async (payload?: CertificationSharePayload): Promise<CertificationShareResult> => {
    const link = getCertificationLink(payload);

    try {
      if (postAndroidCertificationImage('share', payload)) {
        return 'shared';
      }
    } catch (error) {
      if (error instanceof Error) {
        await copyCertificationLink(link);
        return 'copied';
      }
      throw error;
    }

    if (isIosNativeWebView()) {
      try {
        const file = requirePreparedImage(payload).file;
        await shareCertificationFile(file);
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'shared';
        }
        if (error instanceof Error) {
          await copyCertificationLink(link);
          return 'copied';
        }
        throw error;
      }
    }

    let file: File;

    try {
      file = requirePreparedImage(payload).file;
    } catch (error) {
      if (error instanceof Error) {
        await copyCertificationLink(link);
        return 'copied';
      }
      throw error;
    }

    const shareData: ShareData = {
      title: payload?.title || SHARE_TITLE,
      text: payload?.subtitle || SHARE_TEXT,
      url: link,
      files: [file],
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'shared';
        }
      }
    }

    try {
      await downloadCertificationImage(file);
      return 'downloaded';
    } catch (error) {
      if (error instanceof Error) {
        await copyCertificationLink(link);
        return 'copied';
      }
      throw error;
    }
  };

  const downloadCertificationImage = async (
    existingBlob?: Blob,
    payload?: CertificationSharePayload,
  ): Promise<void> => {
    if (postAndroidCertificationImage('save', payload)) {
      return;
    }

    if (isIosNativeWebView()) {
      try {
        await shareCertificationFile(requirePreparedImage(payload).file);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          throw error;
        }
      }
      return;
    }

    const blob = existingBlob ?? requirePreparedImage(payload).file;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = FILE_NAME;
      document.body.append(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  };

  const copyCertificationLink = async (link = getCertificationLink()): Promise<void> => {
    await navigator.clipboard.writeText(link);
  };

  return {
    shareCertification,
    downloadCertificationImage,
    copyCertificationLink,
  };
};
