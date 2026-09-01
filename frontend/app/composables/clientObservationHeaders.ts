type ShellIdentity = {
  readonly appVersion?: unknown
}

type ClientObservationInput = {
  readonly isNativeApp: boolean
  readonly isAndroidApp: boolean
  readonly shellIdentity: ShellIdentity | null | undefined
}

type ClientObservationHeaders = Record<string, string>

const SAFE_APP_VERSION = /^[A-Za-z0-9._+-]{1,32}$/

export const buildClientObservationHeaders = (
  input: ClientObservationInput,
): ClientObservationHeaders => {
  if (!input.isNativeApp) {
    return {
      'X-Client': 'web',
      'X-App-Platform': 'web',
    }
  }

  const headers: ClientObservationHeaders = {
    'X-Client': input.shellIdentity ? 'shell' : 'legacy-shell',
    'X-App-Platform': input.isAndroidApp ? 'android' : 'ios',
  }
  const appVersion = input.shellIdentity?.appVersion
  if (typeof appVersion === 'string' && SAFE_APP_VERSION.test(appVersion)) {
    headers['X-App-Version'] = appVersion
  }
  return headers
}
