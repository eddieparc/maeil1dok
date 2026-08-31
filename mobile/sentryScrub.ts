const SENSITIVE_KEYS = new Set([
  'access',
  'accesstoken',
  'apikey',
  'authorization',
  'clientsecret',
  'code',
  'cookie',
  'csrftoken',
  'email',
  'idtoken',
  'ipaddress',
  'password',
  'phonenumber',
  'profileimage',
  'providerid',
  'proxyauthorization',
  'refreshtoken',
  'secret',
  'sessionid',
  'setcookie',
  'signuptoken',
  'state',
  'suggestednickname',
  'token',
  'username',
  'xapikey',
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const JSON_STRING_PATTERN =
  /(["'](?:access|access_token|refresh|refresh_token|id_token|signup_token|token|code|state|password|authorization|csrftoken|api_key|client_secret|secret|sessionid)["']\s*:\s*["'])[^"']*(["'])/gi;
const ASSIGNMENT_PATTERN =
  /\b(access|access_token|refresh|refresh_token|id_token|signup_token|token|code|state|password|authorization|csrftoken|api_key|client_secret|secret|sessionid)(\s*[=:]\s*)[^&\s,;"']+/gi;

const normalizedKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

const redactString = (value: string): string =>
  value
    .replace(EMAIL_PATTERN, '[redacted]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(JWT_PATTERN, '[redacted]')
    .replace(JSON_STRING_PATTERN, '$1[redacted]$2')
    .replace(ASSIGNMENT_PATTERN, '$1$2[redacted]');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scrubValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, seen));
  if (!isRecord(value) || seen.has(value)) return value;

  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    value[key] = SENSITIVE_KEYS.has(normalizedKey(key))
      ? '[redacted]'
      : scrubValue(nested, seen);
  }
  return value;
};

export const scrubMobileSentryEvent = <T>(event: T): T => {
  if (!isRecord(event)) return event;
  scrubValue(event, new WeakSet());

  const user = event.user;
  if (isRecord(user)) {
    delete user.email;
    delete user.ip_address;
    delete user.username;
  }

  const request = event.request;
  if (isRecord(request) && isRecord(request.headers)) {
    for (const key of Object.keys(request.headers)) {
      if (SENSITIVE_KEYS.has(normalizedKey(key))) {
        delete request.headers[key];
      }
    }
  }
  return event;
};
