import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import CookieManager from '@react-native-cookies/cookies';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  BETA_STACK,
  PROD_STACK,
  resolveStack,
} from '../betaMode';
import { buildLocationAssignmentScript } from '../deepLink';
import { redactSensitiveUrl } from '../urlRedaction';
import { csrfHeadersFrom } from '../csrfHeader';
import { hasAuthCookies, runStoredSessionRestore } from '../sessionRestore';
import { buildNativeClientObservationHeaders } from '../clientObservationHeaders';
import { buildSessionBridgeConsumeUrl } from '../sessionBridgeNavigation';
import { isFatalWebViewError, shouldAllowWebViewNavigation } from '../webviewNavigation';
import {
  buildSocialSignupNavigation,
  type SocialSignupData,
  type SocialSignupProvider,
} from '../socialSignupNavigation';
import {
  handleCertificationImageMessage,
  type CertificationImageBridgeDependencies,
} from '../certificationImageBridge';
import {
  buildAppleNativeLinkFailure,
  buildAppleNativeLinkSuccess,
  parseAppleNativeLinkRequest,
} from '../appleNativeLink';
import type { BundleIdentity } from '../bundleIdentity';
import { useAppStack } from '../navigation/AppStackContext';
import {
  getPushInstallationId,
  isPushBridgeOrigin,
  isPushBridgeRequest,
  nativePushStateScript,
} from '../nativePush';
import { NativePushOperationError } from '../nativePushLifecycle';
import { useAuth } from '../auth/AuthSession';
import { createTokenStore } from '../api/authTokens';
import { navigationRef, type RootStackParamList } from '../navigation/navigationRef';

/**
 * `decelerationRate` is typed Float by Fabric codegen. The documented `'normal'`
 * string form crashed the app on launch under the new architecture:
 *
 *   java.lang.ClassCastException: java.lang.String cannot be cast to java.lang.Double
 *       at RNCWebViewManagerDelegate.setProperty
 *
 * Observed on the Android emulator. 0.998 is the numeric value `'normal'` meant.
 */
const DECELERATION_RATE_NORMAL = 0.998;

const CERTIFICATION_IMAGE_MIME_TYPE = 'image/png';

class CertificationImageNativeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificationImageNativeError';
  }
}

const certificationImageDependencies: CertificationImageBridgeDependencies = {
  writeImage: async (fileName, base64) => {
    if (!FileSystem.cacheDirectory) {
      throw new CertificationImageNativeError('인증 이미지 캐시를 열 수 없습니다.');
    }
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  },
  shareImage: async (fileUri) => {
    if (!await Sharing.isAvailableAsync()) {
      throw new CertificationImageNativeError('이 기기에서는 이미지 공유를 사용할 수 없습니다.');
    }
    await Sharing.shareAsync(fileUri, {
      dialogTitle: '매일일독 통독 인증 카드',
      mimeType: CERTIFICATION_IMAGE_MIME_TYPE,
    });
  },
  saveImage: async (fileUri) => {
    await MediaLibrary.saveToLibraryAsync(fileUri);
    Alert.alert('이미지 저장 완료', '통독 인증 카드를 갤러리에 저장했습니다.');
  },
};

type WebViewUrlEvent = {
  readonly nativeEvent: {
    readonly url?: string;
  };
};

type WebViewErrorLikeEvent = {
  readonly nativeEvent: {
    readonly description?: string;
    readonly statusCode?: number;
    readonly code?: number;
    readonly url?: string;
  };
};

const NATIVE_CLIENT_OBSERVATION_HEADERS = buildNativeClientObservationHeaders({
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  appVersion: Constants.expoConfig?.version,
});

const isErrorWithCode = (error: unknown, code: string): boolean => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === code
);

/**
 * Everything the WebView shell owns, exposed to the rest of the app:
 * LoginScreen drives the session bridge through it, App.tsx routes deep links
 * and the Android back button through it, and WebViewScreen renders the
 * actual <WebView> from it.
 *
 * The closures below are load-bearing under their exact names: the test
 * harnesses extract them from this file's AST and inject dependencies by
 * identifier, so renames or signature changes must update test/helpers/*.
 */
export type WebViewController = {
  readonly webViewKey: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly canGoBack: boolean;
  readonly pushToken: string | null;
  readonly bundleIdentity: BundleIdentity;
  readonly webViewRef: React.RefObject<WebView | null>;
  readonly isWebViewMounted: () => boolean;
  readonly setWebViewMounted: (mounted: boolean) => void;
  readonly setPushToken: (token: string | null) => void;
  readonly registerForPushNotifications: () => Promise<void>;
  readonly showNativeLogin: () => void;
  readonly hideNativeLogin: () => void;
  readonly goBack: () => void;
  readonly navigateToUrl: (url: string) => void;
  readonly queuePendingUrl: (url: string) => void;
  readonly navigateToPendingUrl: () => void;
  readonly initiateSessionBridge: (accessToken: string, refreshToken: string) => Promise<boolean>;
  readonly navigateToSocialSignup: (provider: SocialSignupProvider, data: SocialSignupData) => void;
  readonly handleNavigationStateChange: (navState: WebViewNavigation) => void;
  readonly handleShouldStartLoadWithRequest: (request: { url: string; isTopFrame?: boolean }) => boolean;
  readonly handleLoadEnd: (syntheticEvent: WebViewUrlEvent) => void;
  readonly handleLoad: () => void;
  readonly handleError: (syntheticEvent: WebViewErrorLikeEvent) => void;
  readonly handleHttpError: (syntheticEvent: WebViewErrorLikeEvent) => void;
  readonly handleMessage: (event: { nativeEvent: { data: string; url?: string } }) => void;
  readonly handleRetry: () => void;
  readonly consumePendingScript: () => void;
  readonly remountWebView: () => void;
};

const WebViewControllerContext = createContext<WebViewController | null>(null);

export function useWebViewController(): WebViewController {
  const controller = useContext(WebViewControllerContext);
  if (!controller) {
    throw new Error('useWebViewController must be used inside WebViewControllerProvider');
  }
  return controller;
}

export function WebViewControllerProvider({
  bundleIdentity,
  children,
}: {
  bundleIdentity: BundleIdentity;
  children: ReactNode;
}) {
  const { stack, betaMode, setBetaMode } = useAppStack();
  const tokenStore = useMemo(() => createTokenStore(SecureStore, betaMode === true), [betaMode]);
  const { signOut, pushRuntime, status: authStatus } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isError, setIsError] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const pendingScriptRef = useRef<string | null>(null);
  // Injecting into a WebView that has not finished its first load loses the
  // navigation silently — the in-flight document is replaced by the initial
  // page. Pending navigations must wait for the first loadEnd.
  const firstLoadDoneRef = useRef(false);
  const webViewMountedRef = useRef(false);
  const currentWebViewUrlRef = useRef(stack.web);
  const dnsRetryAvailableRef = useRef(true);
  const restoreGenerationRef = useRef(0);
  const restorePromiseRef = useRef<Promise<boolean> | null>(null);

  // Derived per render from the persisted beta flag. The constant-style names
  // are load-bearing: test harnesses extract these closures and inject the
  // dependencies under exactly these identifiers.
  const WEB_APP_URL = stack.web;
  const API_URL = stack.api;
  // Both stacks' origins are first-party so a beta:set toggle can navigate to
  // the target stack before the WebView remounts onto it.
  const WEBVIEW_POLICY = {
    webAppUrl: WEB_APP_URL,
    apiUrl: API_URL,
    extraOrigins: [PROD_STACK.web, PROD_STACK.api, BETA_STACK.web, BETA_STACK.api],
  };

  const showNativeLogin = () => {
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'Login') {
      navigationRef.navigate('Login');
    }
  };

  const hideNativeLogin = () => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = '/';
        }
        true;
      `);
    }
  };

  const initiateSessionBridge = async (accessToken: string, refreshToken: string): Promise<boolean> => {
    console.log('[SessionBridge] Starting');

    try {
      console.log('[SessionBridge] Saving to SecureStore...');
      await tokenStore.write({ access: accessToken, refresh: refreshToken });
      console.log('[SessionBridge] SecureStore save success');

      console.log('[SessionBridge] Calling session/issue...');
      const csrfCookies = await CookieManager.get(API_URL).catch(() => null);
      const issueResponse = await fetch(`${API_URL}/api/v1/auth/session/issue/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...NATIVE_CLIENT_OBSERVATION_HEADERS,
          ...csrfHeadersFrom(csrfCookies),
        },
      });

      console.log('[SessionBridge] session/issue response status:', issueResponse.status);

      if (!issueResponse.ok) {
        const errorText = await issueResponse.text();
        console.log('[SessionBridge] session/issue error:', errorText);
        return false;
      }

      const issueData = await issueResponse.json();
      const code = issueData.code;

      if (code) {
        // A queued destination (e.g. a menu tap that opened this screen) must
        // survive the bridge: consume redirects to `next`, so prefer the
        // pending URL over the page currently loaded. A stale consume URL
        // must never be reused — its one-time code is already spent.
        const pendingTarget = pendingUrlRef.current;
        const nextTarget =
          pendingTarget && !pendingTarget.includes('/api/v1/auth/session/consume')
            ? pendingTarget
            : currentWebViewUrlRef.current;
        const consumeUrl = buildSessionBridgeConsumeUrl({
          apiUrl: API_URL,
          webAppUrl: WEB_APP_URL,
          code,
          currentUrl: nextTarget,
        });
        console.log('[SessionBridge] Session code issued');
        pendingUrlRef.current = consumeUrl;
        setPendingUrl(consumeUrl);
        return true;
      }
      console.log('[SessionBridge] No code in response');
      return false;
    } catch (error) {
      console.error('[SessionBridge] Error:', error);
      return false;
    }
  };

  const navigateToPendingUrl = () => {
    const urlToNavigate = pendingUrlRef.current;
    const webView = webViewRef.current;
    // Before the first loadEnd the injected location change races the
    // in-flight initial document and is silently discarded. Keep the URL
    // queued; handleLoadEnd retries once a real page is up.
    if (!urlToNavigate || !webView || !firstLoadDoneRef.current) return;

    pendingUrlRef.current = null;
    setPendingUrl(null);
    webView.injectJavaScript(`window.location.href = ${JSON.stringify(urlToNavigate)}; true;`);
  };

  const queuePendingUrl = (url: string) => {
    pendingUrlRef.current = url;
    setPendingUrl(url);
  };

  const navigateToSocialSignup = (
    provider: SocialSignupProvider,
    data: SocialSignupData,
  ) => {
    const navigation = buildSocialSignupNavigation(WEB_APP_URL, provider, data);
    pendingUrlRef.current = null;
    setPendingUrl(null);
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'WebView') {
      navigationRef.navigate('WebView', {});
    }
    // The WebView may not be mounted yet (login was the root screen). Queue the
    // script so the screen injects it once the first page load finishes.
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(navigation.script);
    } else {
      pendingScriptRef.current = navigation.script;
    }
  };

  const consumePendingScript = () => {
    const script = pendingScriptRef.current;
    if (script && webViewRef.current) {
      pendingScriptRef.current = null;
      webViewRef.current.injectJavaScript(script);
    }
  };

  const navigateToUrl = (url: string) => {
    const webView = webViewRef.current;
    // A mounted-but-still-loading WebView cannot take an injected navigation
    // either — route through the param path so the URL is queued and consumed
    // on the first loadEnd instead of being lost.
    if (webView && webViewMountedRef.current && firstLoadDoneRef.current) {
      webView.injectJavaScript(buildLocationAssignmentScript(url));
      return;
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('WebView', { url });
    }
  };

  const goBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const invalidateStoredSessionRestore = () => {
    restoreGenerationRef.current += 1;
    restorePromiseRef.current = null;
  };

  // AuthSession.signOut runs the same clearMobileAuth cleanup this used to do
  // inline AND flips the session status, so the native tabs stop rendering
  // signed-in UI on dead tokens. Guests can browse the tabs now, so logout
  // lands back on the tab bar instead of forcing the login modal. The remount
  // stays: the WebView must reload on the cleared cookie store.
  const finishNativeLogout = async () => {
    await signOut().catch((error) => {
      console.error('[Logout] Sign-out error:', error);
    });
    setWebViewKey((previous) => previous + 1);
  };

  /**
   * Give up on restoring the stored session WITHOUT destroying anything.
   *
   * A failed restore is not evidence that the session is over. The usual cause is
   * that the web app already rotated the refresh token, which leaves this stored
   * copy stale while the webview cookies remain perfectly valid. Clearing cookies
   * here (the old behaviour) destroyed a live session and logged the user out for
   * having used the app; deleting the stored tokens removed the only chance a later
   * restore had of succeeding.
   *
   * Explicit logout still clears everything — that is a user instruction, not an
   * inference drawn from one failed request.
   */
  const abandonRestore = (reason: string): boolean => {
    console.log(`[SessionRestore] giving up without clearing auth: ${reason}`);
    return false;
  };

  const restoreStoredSession = (): Promise<boolean> => {
    if (restorePromiseRef.current) return restorePromiseRef.current;

    const generation = restoreGenerationRef.current;
    let restorePromise: Promise<boolean>;
    restorePromise = (async () => {
      const cookies = await CookieManager.get(API_URL).catch(() => null);
      if (
        restoreGenerationRef.current !== generation
        || hasAuthCookies(cookies, tokenStore.cookieNames)
      ) {
        return false;
      }

      return runStoredSessionRestore({
        apiUrl: API_URL,
        readRefreshToken: async () => (await tokenStore.read()).refresh,
        readCsrfHeaders: async () => {
          // 본문 토큰을 제시하므로 서버는 이 요청에 CSRF 를 요구하지 않는다. 그래도
          // 헤더를 싣는다 — 서버 정책이 다시 조여지면 셸이 조용히 403 으로 죽는다.
          const refreshCookies = await CookieManager.get(API_URL).catch(() => null);
          return {
            ...NATIVE_CLIENT_OBSERVATION_HEADERS,
            ...csrfHeadersFrom(refreshCookies),
          };
        },
        fetchRefresh: (url, init) => fetch(url, init),
        initiateSessionBridge,
        navigateToPendingUrl,
        abandonRestore,
        reportError: (error) => console.error('[SessionRestore] Error:', error),
        isRestoreCurrent: () => restoreGenerationRef.current === generation,
      });
    })().finally(() => {
      if (restorePromiseRef.current === restorePromise) {
        restorePromiseRef.current = null;
      }
    });
    restorePromiseRef.current = restorePromise;
    return restorePromise;
  };

  const requestAppleCredential = () =>
    AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

  const handleAppleLinkRequest = async (state: string) => {
    try {
      const credential = await requestAppleCredential();
      webViewRef.current?.postMessage(JSON.stringify(buildAppleNativeLinkSuccess({
        state,
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
      })));
    } catch (error: unknown) {
      const cancelled = typeof error === 'object'
        && error !== null
        && Reflect.get(error, 'code') === 'ERR_REQUEST_CANCELED';
      webViewRef.current?.postMessage(JSON.stringify(
        buildAppleNativeLinkFailure(state, cancelled),
      ));
    }
  };

  const injectPushToken = () => {
    if (pushToken && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          window.nativePushToken = '${pushToken}';
          window.dispatchEvent(new CustomEvent('nativePushToken', { detail: '${pushToken}' }));
        })();
        true;
      `);
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('[WebView] NavigationState:', redactSensitiveUrl(navState.url), 'loading:', navState.loading);
    currentWebViewUrlRef.current = navState.url;
    setCanGoBack(navState.canGoBack);
    if (navState.url.includes('/login') && navState.url.startsWith(WEB_APP_URL)) {
      showNativeLogin();
    }
  };

  const handleShouldStartLoadWithRequest = (request: { url: string; isTopFrame?: boolean }) => {
    const { url } = request;
    const allowed = shouldAllowWebViewNavigation(request, WEBVIEW_POLICY);
    console.log('[WebView] ShouldStartLoad:', redactSensitiveUrl(url), 'topFrame:', request.isTopFrame !== false, 'allowed:', allowed);

    if (allowed) {
      return true;
    }

    if (url.includes('/login') && url.startsWith(WEB_APP_URL)) {
      console.log('[WebView] Blocked: login page, showing native login');
      showNativeLogin();
      return false;
    }

    // YouTube 앱 딥링크 (youtube:// 스킴) → 네이티브로 열기
    if (url.startsWith('youtube://') || url.startsWith('vnd.youtube://') || url.startsWith('intent://')) {
      console.log('[WebView] Opening YouTube app:', redactSensitiveUrl(url));
      Linking.openURL(url).catch(() => {
        // 앱이 없으면 웹으로 폴백
        const videoIdMatch = url.match(/[?&]v=([^&#]+)/);
        if (videoIdMatch) {
          Linking.openURL(`https://www.youtube.com/watch?v=${videoIdMatch[1]}`);
        }
      });
      return false;
    }

    console.log('[WebView] Blocked: external URL');
    return false;
  };

  const handleLoadEnd = (syntheticEvent: WebViewUrlEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('[WebView] LoadEnd:', redactSensitiveUrl(nativeEvent?.url));
    setIsLoading(false);
    setIsError(false);
    firstLoadDoneRef.current = true;
    SplashScreen.hideAsync();
    injectPushToken();
    navigateToPendingUrl();
  };

  const handleLoad = () => {
    dnsRetryAvailableRef.current = true;
  };

  const handleError = (syntheticEvent: WebViewErrorLikeEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('[WebView] Error:', nativeEvent?.description || 'unknown', 'code:', nativeEvent?.code, 'url:', redactSensitiveUrl(nativeEvent?.url));

    // 임베드 내부의 서드파티 프레임 실패나 취소는 앱 전체 실패가 아니다.
    // (하세나 YouTube 임베드의 광고 프레임 때문에 첫 진입에서 에러 화면이 뜨던 원인)
    if (!isFatalWebViewError(nativeEvent, WEBVIEW_POLICY)) {
      console.log('[WebView] Non-fatal error ignored');
      return;
    }

    if (
      Platform.OS === 'ios'
      && nativeEvent?.code === -1003
      && dnsRetryAvailableRef.current
    ) {
      dnsRetryAvailableRef.current = false;
      setIsError(false);
      setIsLoading(true);
      setWebViewKey((prev) => prev + 1);
      return;
    }

    setIsLoading(false);
    setIsError(true);
    SplashScreen.hideAsync();
  };

  const handleHttpError = (syntheticEvent: WebViewErrorLikeEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('[WebView] HttpError:', nativeEvent?.statusCode, nativeEvent?.description, 'url:', redactSensitiveUrl(nativeEvent?.url));
  };

  const registerForPushNotifications = async () => {
    if (authStatus !== 'signedIn') return;
    const origin = WEB_APP_URL;
    const state = await pushRuntime.sync();
    setPushToken(state.token);
    if (isPushBridgeOrigin(currentWebViewUrlRef.current, origin)) {
      webViewRef.current?.injectJavaScript(nativePushStateScript(state));
    }
  };

  const handleMessage = (event: { nativeEvent: { data: string; url?: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (isPushBridgeRequest(message)) {
        const origin = WEB_APP_URL;
        if (!isPushBridgeOrigin(event.nativeEvent.url, origin)) return;
        const operation = message.managed === true && authStatus === 'signedIn'
          ? pushRuntime.request(message.type, message.requestId)
          : Promise.reject(new NativePushOperationError('알림 설정 화면을 다시 열어 주세요.'));
        void operation.then((state) => {
          if (!isPushBridgeOrigin(currentWebViewUrlRef.current, origin)) return;
          setPushToken(state.token);
          webViewRef.current?.injectJavaScript(nativePushStateScript(state));
        }).catch((error: unknown) => {
          if (!isPushBridgeOrigin(currentWebViewUrlRef.current, origin)) return;
          webViewRef.current?.injectJavaScript(nativePushStateScript({
            requestId: message.requestId,
            permission: 'default',
            token: null,
            platform: Platform.OS === 'android' ? 'android' : 'ios',
            installationId: '',
            managed: true,
            subscribed: false,
            error: error instanceof Error ? error.message : '기기 알림 설정을 확인하지 못했습니다.',
          }));
        });
        return;
      }
      switch (message.type) {
        case 'requestLogout':
          invalidateStoredSessionRestore();
          (async () => {
            try {
              // 1. 백엔드 로그아웃 API 호출
              // 서버는 refresh 쿠키가 있으면 CSRF 를 요구하는데, 네이티브 fetch 에는
              // Origin 도 Referer 도 없다. 공유 쿠키 저장소의 토큰을 직접 실어야
              // 통과한다 — 없이 보내면 403 이라 refresh 토큰이 블랙리스트되지 않고
              // 로그아웃이 서버에 붙지 않는다.
              const csrfCookies = await CookieManager.get(API_URL).catch(() => null);
              const installationId = await getPushInstallationId();
              await fetch(`${API_URL}/api/v1/auth/logout/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  ...NATIVE_CLIENT_OBSERVATION_HEADERS,
                  ...csrfHeadersFrom(csrfCookies),
                },
                body: JSON.stringify({ installation_id: installationId }),
              });
            } catch (error) {
              console.error('Logout API error:', error);
            }

            await finishNativeLogout();
          })();
          break;
        case 'auth:request':
          restoreStoredSession().catch((error) => {
            console.error('[SessionRestore] Failed:', error);
          });
          break;
        case 'auth:apple:link': {
          const state = parseAppleNativeLinkRequest(message);
          if (state) {
            void handleAppleLinkRequest(state);
          }
          break;
        }
        case 'auth:logout':
        case 'auth:expired':
        case 'logout':
          invalidateStoredSessionRestore();
          void finishNativeLogout();
          break;
        case 'navigate':
          if (message.url) {
            const isYouTube = /(?:youtube\.com|youtu\.be)/.test(message.url);
            if (isYouTube) {
              Linking.openURL(message.url);
            } else {
              WebBrowser.openBrowserAsync(message.url, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              });
            }
          }
          break;
        case 'requestPushToken':
          injectPushToken();
          break;
        case 'beta:set': {
          // The page asked to switch stacks; the shell owns the navigation.
          // Persist first so a crash mid-switch still lands on the requested
          // stack next launch, then remount the WebView on the new origin.
          const enabled = message.enabled === true;
          const target = resolveStack(enabled);
          void (async () => {
            await setBetaMode(enabled);
            pendingUrlRef.current = null;
            setPendingUrl(null);
            firstLoadDoneRef.current = false;
            currentWebViewUrlRef.current = target.web;
            setIsLoading(true);
            setWebViewKey((previous) => previous + 1);
          })().catch((error) => console.error('[BetaMode] Switch failed:', error));
          break;
        }
        case 'certification:image':
          handleCertificationImageMessage(message, certificationImageDependencies)
            .then((handled) => {
              if (!handled) {
                throw new CertificationImageNativeError('올바르지 않은 인증 이미지 요청입니다.');
              }
            })
            .catch((error) => {
              const detail = error instanceof Error ? error.message : '알 수 없는 오류';
              console.error('[CertificationImage] Native action failed:', detail);
              Alert.alert('이미지 작업 실패', detail);
            });
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };

  const handleRetry = () => {
    setIsError(false);
    setIsLoading(true);
    firstLoadDoneRef.current = false;
    webViewRef.current?.reload();
  };

  // The old shell's `setWebViewKey(prev => prev + 1)` after a failed bridge or
  // an explicit logout: remount the WebView so it reloads on current cookies.
  const remountWebView = () => {
    firstLoadDoneRef.current = false;
    setWebViewKey((previous) => previous + 1);
  };

  const controller: WebViewController = {
    webViewKey,
    isLoading,
    isError,
    canGoBack,
    pushToken,
    bundleIdentity,
    webViewRef,
    isWebViewMounted: () => webViewMountedRef.current,
    setWebViewMounted: (mounted: boolean) => {
      webViewMountedRef.current = mounted;
    },
    setPushToken,
    registerForPushNotifications,
    showNativeLogin,
    hideNativeLogin,
    goBack,
    navigateToUrl,
    queuePendingUrl,
    navigateToPendingUrl,
    initiateSessionBridge,
    navigateToSocialSignup,
    handleNavigationStateChange,
    handleShouldStartLoadWithRequest,
    handleLoadEnd,
    handleLoad,
    handleError,
    handleHttpError,
    handleMessage,
    handleRetry,
    consumePendingScript,
    remountWebView,
  };

  return (
    <WebViewControllerContext.Provider value={controller}>
      {children}
    </WebViewControllerContext.Provider>
  );
}

export default function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'WebView'>>();
  const controller = useWebViewController();
  const {
    webViewKey,
    isLoading,
    isError,
    bundleIdentity,
    webViewRef,
    handleNavigationStateChange,
    handleShouldStartLoadWithRequest,
    handleLoadEnd,
    handleLoad,
    handleError,
    handleHttpError,
    handleMessage,
    handleRetry,
    consumePendingScript,
    queuePendingUrl,
    navigateToPendingUrl,
  } = controller;
  const { stack } = useAppStack();
  const WEB_APP_URL = stack.web;

  // The screen owns the mounted flag so controller.navigateToUrl can tell a
  // live WebView (inject) from an absent one (navigate with params).
  useEffect(() => {
    controller.setWebViewMounted(true);
    return () => controller.setWebViewMounted(false);
  }, [controller]);

  // A deep link that arrived while the WebView was not mounted lands here as a
  // route param; queue it so the first loadEnd navigates to it. The consumed
  // ref stops a re-render from re-injecting the same URL forever.
  const consumedUrlParamRef = useRef<string | null>(null);
  useEffect(() => {
    const url = route.params?.url;
    if (url && consumedUrlParamRef.current !== url) {
      consumedUrlParamRef.current = url;
      queuePendingUrl(url);
      navigateToPendingUrl();
    }
  }, [route.params?.url, queuePendingUrl, navigateToPendingUrl]);

  if (isError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
        <View style={styles.errorContent}>
          <Text style={styles.errorEmoji}>📖</Text>
          <Text style={styles.errorTitle}>연결할 수 없습니다</Text>
          <Text style={styles.errorMessage}>
            인터넷 연결을 확인하고{'\n'}다시 시도해주세요
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webView}
        onLoad={handleLoad}
        onLoadEnd={(event) => {
          handleLoadEnd(event);
          consumePendingScript();
        }}
        onError={handleError}
        onHttpError={handleHttpError}
        onContentProcessDidTerminate={handleRetry}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={`
          window.isReactNativeWebView = true;
          window.nativePushManaged = true;
          window.__shellBetaMode = true;
          window.isAndroidApp = ${Platform.OS === 'android'};
          true;
        `}
        javaScriptEnabled={true}
        // Debug/dev builds only: lets Safari Web Inspector attach to the
        // WKWebView for QA. No effect in release builds.
        webviewDebuggingEnabled={__DEV__}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsBackForwardNavigationGestures={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        androidLayerType="hardware"
        decelerationRate={DECELERATION_RATE_NORMAL}
        pullToRefreshEnabled={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        injectedJavaScript={`
          (function() {
            window.isReactNativeWebView = true;
            window.nativePushManaged = true;
            // Capability flag: the page uses this to know the shell can switch
            // stacks on 'beta:set'. An old shell lacks it, so the page falls
            // back to window.location.assign (browser) or an alert (old shell).
            window.__shellBetaMode = true;
            // Which shell bundle the page is running inside. The native login
            // screen shows the same thing, but only when signed OUT — this is the
            // copy an operator can read while signed in. Its ABSENCE is also an
            // answer: an old shell injects isReactNativeWebView and not this.
            window.__shellBundleIdentity = ${JSON.stringify(bundleIdentity)};
            window.isAndroidApp = ${Platform.OS === 'android'};
            window.nativeInsets = { top: ${insets.top}, bottom: ${insets.bottom}, left: ${insets.left}, right: ${insets.right} };
            window.requestNativePushToken = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestPushToken' }));
            };
            document.documentElement.style.setProperty('--native-top-inset', '${insets.top}px');
            document.documentElement.style.setProperty('--native-bottom-inset', '${insets.bottom}px');
            if (document.body) {
              document.body.classList.add('native-app');
              if (${Platform.OS === 'android'}) {
                document.body.classList.add('android-native-app');
              }
            }
          })();
          true;
        `}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4B9F7E" />
          </View>
        )}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4B9F7E" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  webView: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf8f6',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#faf8f6',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4B9F7E',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
    fontSize: 16,
  },
});
