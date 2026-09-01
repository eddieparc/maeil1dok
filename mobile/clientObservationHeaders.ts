type NativeClientObservationInput = {
  readonly platform: 'android' | 'ios'
  readonly appVersion?: unknown
}

type NativeClientObservationHeaders = Record<string, string>

const SAFE_APP_VERSION = /^[A-Za-z0-9._+-]{1,32}$/

export const buildNativeClientObservationHeaders = (
  input: NativeClientObservationInput,
): NativeClientObservationHeaders => {
  const headers: NativeClientObservationHeaders = {
    'X-Client': 'shell',
    'X-App-Platform': input.platform,
  }
  if (
    typeof input.appVersion === 'string'
    && SAFE_APP_VERSION.test(input.appVersion)
  ) {
    headers['X-App-Version'] = input.appVersion
  }
  return headers
}
