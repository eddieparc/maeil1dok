const SENSITIVE_QUERY_KEYS = new Set([
  'access',
  'access_token',
  'code',
  'email',
  'refresh',
  'refresh_token',
  'id_token',
  'profile_image',
  'provider_id',
  'signup_token',
  'state',
  'suggested_nickname',
  'token',
]);

const SENSITIVE_PARAMETER_PATTERN =
  /([?&#;](?:access|access_token|code|email|refresh|refresh_token|id_token|profile_image|provider_id|signup_token|state|suggested_nickname|token)=)[^&#;]*/gi;

const redactSensitiveParameters = (value: string): string =>
  value.replace(SENSITIVE_PARAMETER_PATTERN, '$1[redacted]');

const redactIntentBrowserFallbackUrl = (hash: string): string =>
  hash.replace(
    /(S\.browser_fallback_url=)([^;#]*)/gi,
    (match, prefix: string, encodedFallbackUrl: string): string => {
      try {
        const decodedFallbackUrl = decodeURIComponent(encodedFallbackUrl);
        return `${prefix}${encodeURIComponent(redactSensitiveParameters(decodedFallbackUrl))}`;
      } catch (error) {
        if (error instanceof URIError) {
          return `${prefix}${redactSensitiveParameters(encodedFallbackUrl)}`;
        }
        throw error;
      }
    },
  );

export const redactSensitiveUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) return 'unknown';

  try {
    const parsedUrl = new URL(rawUrl);
    for (const key of parsedUrl.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsedUrl.searchParams.set(key, '[redacted]');
      }
    }
    parsedUrl.hash = redactSensitiveParameters(
      redactIntentBrowserFallbackUrl(parsedUrl.hash),
    );
    return parsedUrl.toString();
  } catch (error) {
    if (error instanceof TypeError) {
      return redactSensitiveParameters(
        redactIntentBrowserFallbackUrl(rawUrl),
      );
    }
    throw error;
  }
};
