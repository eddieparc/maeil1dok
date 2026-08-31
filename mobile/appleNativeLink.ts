export type AppleNativeLinkResult = {
  readonly type: 'auth:apple:link:result';
  readonly data: {
    readonly state: string;
    readonly idToken?: string;
    readonly code?: string;
    readonly error?: 'cancelled' | 'unavailable';
  };
};

type AppleCredential = {
  readonly identityToken: string | null;
  readonly authorizationCode: string | null;
};

const MAX_STATE_LENGTH = 4096;

export const parseAppleNativeLinkRequest = (message: unknown): string | null => {
  if (typeof message !== 'object' || message === null) {
    return null;
  }
  if (Reflect.get(message, 'type') !== 'auth:apple:link') {
    return null;
  }
  const data = Reflect.get(message, 'data');
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const state = Reflect.get(data, 'state');
  return typeof state === 'string'
    && state.length > 0
    && state.length <= MAX_STATE_LENGTH
    ? state
    : null;
};

export const buildAppleNativeLinkSuccess = ({
  state,
  identityToken,
  authorizationCode,
}: {
  readonly state: string;
  readonly identityToken: AppleCredential['identityToken'];
  readonly authorizationCode: AppleCredential['authorizationCode'];
}): AppleNativeLinkResult => {
  if (!identityToken) {
    return buildAppleNativeLinkFailure(state, false);
  }
  return {
    type: 'auth:apple:link:result',
    data: {
      state,
      idToken: identityToken,
      code: authorizationCode ?? '',
    },
  };
};

export const buildAppleNativeLinkFailure = (
  state: string,
  cancelled: boolean,
): AppleNativeLinkResult => ({
  type: 'auth:apple:link:result',
  data: {
    state,
    error: cancelled ? 'cancelled' : 'unavailable',
  },
});
