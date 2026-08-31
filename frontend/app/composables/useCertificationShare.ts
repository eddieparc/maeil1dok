type CertificationShareResult = 'shared' | 'downloaded' | 'copied';

export interface CertificationSharePayload {
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
const DEFAULT_SHARE_PAYLOAD: Required<Pick<CertificationSharePayload, 'title' | 'subtitle' | 'footer'>> = {
  title: '오늘 통독 완료',
  subtitle: '오늘도 말씀을 읽었습니다',
  footer: '매일 말씀을 읽는 작은 습관',
};

const getCertificationLink = (payload?: CertificationSharePayload): string => {
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

const readCssToken = (tokenName: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new CertificationImageError('인증 카드 이미지를 만들 수 없습니다.'));
    }, 'image/png');
  });

const canvasToPngFile = (canvas: HTMLCanvasElement): File => {
  const dataUrl = canvas.toDataURL('image/png');
  const encoded = dataUrl.split(',', 2)[1];
  if (!encoded) {
    throw new CertificationImageError('인증 카드 이미지 데이터를 만들 수 없습니다.');
  }

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], FILE_NAME, { type: 'image/png' });
};

const drawCenteredText = (
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color: string,
): void => {
  context.font = font;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.fillText(text, 540, y);
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  if ('roundRect' in context) {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
};

const createCertificationCanvas = (payload?: CertificationSharePayload): HTMLCanvasElement => {
  if (typeof document === 'undefined') {
    throw new CertificationImageError('브라우저에서만 인증 카드를 만들 수 있습니다.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new CertificationImageError('인증 카드 캔버스를 열 수 없습니다.');
  }

  const paper = readCssToken('--color-bg-primary', '#faf8f6');
  const card = readCssToken('--color-bg-card', '#ffffff');
  const accent = readCssToken('--color-accent-primary', '#2A1111');
  const textPrimary = readCssToken('--color-text-primary', '#1f2937');
  const textSecondary = readCssToken('--color-text-secondary', '#4b5563');
  const border = readCssToken('--color-border-default', '#e5e7eb');

  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = card;
  context.strokeStyle = border;
  context.lineWidth = 3;
  context.beginPath();
  drawRoundedRect(context, 96, 120, 888, 1110, 44);
  context.fill();
  context.stroke();

  context.fillStyle = accent;
  context.beginPath();
  context.arc(540, 390, 88, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#ffffff';
  context.lineWidth = 14;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(492, 390);
  context.lineTo(528, 426);
  context.lineTo(596, 348);
  context.stroke();

  const title = payload?.title || DEFAULT_SHARE_PAYLOAD.title;
  const subtitle = payload?.subtitle || DEFAULT_SHARE_PAYLOAD.subtitle;
  const footer = payload?.footer || DEFAULT_SHARE_PAYLOAD.footer;
  const readingRange = payload?.readingRange;
  const progressLine = payload?.progressLine;

  drawCenteredText(context, '매일일독', 250, '600 42px Pretendard, system-ui, sans-serif', accent);
  drawCenteredText(context, title, 590, '700 76px Pretendard, system-ui, sans-serif', textPrimary);
  drawCenteredText(context, subtitle, 700, '500 42px Pretendard, system-ui, sans-serif', textSecondary);
  if (readingRange) {
    drawCenteredText(context, readingRange, 790, '600 38px Pretendard, system-ui, sans-serif', textPrimary);
  }
  if (progressLine) {
    drawCenteredText(context, progressLine, 870, '500 34px Pretendard, system-ui, sans-serif', textSecondary);
  }
  drawCenteredText(context, footer, 1090, '500 34px Pretendard, system-ui, sans-serif', textSecondary);

  return canvas;
};

const createCertificationPngBlob = (payload?: CertificationSharePayload): Promise<Blob> =>
  canvasToPngBlob(createCertificationCanvas(payload));

const createCertificationPngFile = (payload?: CertificationSharePayload): File =>
  canvasToPngFile(createCertificationCanvas(payload));

const isIosNativeWebView = (): boolean => (
  typeof window !== 'undefined'
  && 'isReactNativeWebView' in window
  && window.isReactNativeWebView === true
  && (!('isAndroidApp' in window) || window.isAndroidApp !== true)
);

const shareCertificationFile = async (file: File): Promise<void> => {
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
    throw new CertificationImageError('이 기기에서는 인증 카드 이미지를 공유할 수 없습니다.');
  }
  await navigator.share({ files: [file] });
};

export const useCertificationShare = () => {
  const shareCertification = async (payload?: CertificationSharePayload): Promise<CertificationShareResult> => {
    const link = getCertificationLink(payload);

    if (isIosNativeWebView()) {
      try {
        const file = createCertificationPngFile(payload);
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

    let blob: Blob;

    try {
      blob = await createCertificationPngBlob(payload);
    } catch (error) {
      if (error instanceof Error) {
        await copyCertificationLink(link);
        return 'copied';
      }
      throw error;
    }

    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    const shareData: ShareData = {
      title: SHARE_TITLE,
      text: SHARE_TEXT,
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
      await downloadCertificationImage(blob);
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
    if (isIosNativeWebView()) {
      try {
        await shareCertificationFile(createCertificationPngFile(payload));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          throw error;
        }
      }
      return;
    }

    const blob = existingBlob ?? await createCertificationPngBlob(payload);
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
