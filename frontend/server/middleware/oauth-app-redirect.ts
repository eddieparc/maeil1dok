const ALLOWED_APP_SCHEMES = new Set(['maeil1dok', 'maeil1dok-dev']);

const getSafeAppScheme = (scheme: unknown) => {
  if (typeof scheme !== 'string') return '';
  if (!ALLOWED_APP_SCHEMES.has(scheme)) return '';
  return scheme;
};

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const path = url.pathname;
  
  if (!path.match(/^\/auth\/(kakao|google)\/callback/)) {
    return;
  }
  
  const state = url.searchParams.get('state');
  if (!state) {
    return;
  }
  
  let stateData: { from?: string; scheme?: string } | null = null;
  try {
    stateData = JSON.parse(decodeURIComponent(state));
  } catch {
    return;
  }
  
  const safeScheme = getSafeAppScheme(stateData?.scheme);
  if (stateData?.from !== 'app' || !safeScheme) {
    return;
  }
  
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const provider = path.includes('kakao') ? 'kakao' : 'google';
  
  let deepLink = `${safeScheme}://auth/${provider}/callback`;
  if (code) {
    deepLink += `?code=${code}`;
  } else if (error) {
    deepLink += `?error=${error}`;
  }
  
  return sendRedirect(event, deepLink, 302);
});
