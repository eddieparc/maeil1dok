export type CertificationImageBridgeDependencies = {
  readonly writeImage: (fileName: string, base64: string) => Promise<string>;
  readonly shareImage: (fileUri: string) => Promise<void>;
  readonly saveImage: (fileUri: string) => Promise<void>;
};

type CertificationImageAction = 'share' | 'save';

type CertificationImageMessage = {
  readonly action: CertificationImageAction;
  readonly base64: string;
  readonly fileName: string;
};

const FILE_NAME = 'maeil1dok-tongdok-certification.png';
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_DATA_URL_LENGTH = 12_000_000;

const parseMessage = (message: unknown): CertificationImageMessage | null => {
  if (typeof message !== 'object' || message === null) {
    return null;
  }

  const type = Reflect.get(message, 'type');
  const action = Reflect.get(message, 'action');
  const fileName = Reflect.get(message, 'fileName');
  const dataUrl = Reflect.get(message, 'dataUrl');
  if (
    type !== 'certification:image'
    || (action !== 'share' && action !== 'save')
    || fileName !== FILE_NAME
    || typeof dataUrl !== 'string'
    || dataUrl.length > MAX_DATA_URL_LENGTH
  ) {
    return null;
  }

  const match = PNG_DATA_URL_PATTERN.exec(dataUrl);
  const base64 = match?.[1];
  return base64 ? { action, base64, fileName } : null;
};

export const handleCertificationImageMessage = async (
  message: unknown,
  dependencies: CertificationImageBridgeDependencies,
): Promise<boolean> => {
  const parsed = parseMessage(message);
  if (!parsed) {
    return false;
  }

  const fileUri = await dependencies.writeImage(parsed.fileName, parsed.base64);
  switch (parsed.action) {
    case 'share':
      await dependencies.shareImage(fileUri);
      return true;
    case 'save':
      await dependencies.saveImage(fileUri);
      return true;
  }
};
