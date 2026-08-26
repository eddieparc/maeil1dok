import { getNativeAppScheme } from '#shared/utils/authCallbackRuntime';

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
  
  const safeScheme = getNativeAppScheme(stateData);
  if (!safeScheme) {
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
