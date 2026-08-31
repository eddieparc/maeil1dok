import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
import CookieManager from '@react-native-cookies/cookies';
import { resolveWebViewConfig } from './webviewConfig';
import { buildDeepLinkNavigationUrl, buildLocationAssignmentScript } from './deepLink';
import { redactSensitiveUrl } from './urlRedaction';
import { csrfHeadersFrom } from './csrfHeader';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { initMobileTelemetry } from './sentryTelemetry';
import {
  formatBundleIdentityLabel,
  formatBundleIdentityLine,
  resolveBundleIdentity,
} from './bundleIdentity';
import { isFatalWebViewError, shouldAllowWebViewNavigation } from './webviewNavigation';
import {
  buildSocialSignupNavigation,
  type SocialSignupData,
  type SocialSignupProvider,
} from './socialSignupNavigation';

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

initMobileTelemetry();
SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const WEBVIEW_CONFIG = resolveWebViewConfig(Constants.expoConfig?.extra ?? {});
const WEB_APP_URL = WEBVIEW_CONFIG.webAppUrl;
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.maeil1dok.app';
const APP_SCHEME = 'maeil1dok';

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

const WEBVIEW_POLICY = { webAppUrl: WEB_APP_URL, apiUrl: API_URL };

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';

const isErrorWithCode = (error: unknown, code: string): boolean => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === code
);

function AppContent() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isError, setIsError] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  const [showLogin, setShowLogin] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const dnsRetryAvailableRef = useRef(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Which bundle is actually running. Read once: `expo-updates` values are fixed
  // for the lifetime of the launch, and the OTA reach verdict (handoff H1) needs
  // a value that cannot drift while the operator is reading it.
  const bundleIdentity = useRef(
    resolveBundleIdentity({
      updateId: Updates.updateId,
      runtimeVersion: Updates.runtimeVersion,
      channel: Updates.channel,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      appVersion: Constants.expoConfig?.version,
    }),
  ).current;

  // Two independent observation surfaces on purpose: a device log is unreachable
  // on some phones, and the login footer is unreachable when the app cannot get
  // that far. Either one alone leaves the reach test unanswerable.
  useEffect(() => {
    console.log(formatBundleIdentityLine(bundleIdentity));
  }, [bundleIdentity]);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
        'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
        'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
        'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
      });
      setFontsLoaded(true);
      SplashScreen.hideAsync();
    };
    loadFonts();
  }, []);

  const showNativeLogin = () => {
    setEmail('');
    setPassword('');
    setShowLogin(true);
  };

  const hideNativeLogin = () => {
    setShowLogin(false);
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
      await SecureStore.setItemAsync('maeil1dok_access_token', accessToken);
      await SecureStore.setItemAsync('maeil1dok_refresh_token', refreshToken);
      console.log('[SessionBridge] SecureStore save success');

      console.log('[SessionBridge] Calling session/issue...');
      const issueResponse = await fetch(`${API_URL}/api/v1/auth/session/issue/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
        const consumeUrl = `${API_URL}/api/v1/auth/session/consume/?code=${code}&next=${encodeURIComponent(WEB_APP_URL + '/')}`;
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
    if (!urlToNavigate) return;

    pendingUrlRef.current = null;
    setPendingUrl(null);
    webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(urlToNavigate)}; true;`);
  };

  const navigateToSocialSignup = (
    provider: SocialSignupProvider,
    data: SocialSignupData,
  ) => {
    const navigation = buildSocialSignupNavigation(WEB_APP_URL, provider, data);
    pendingUrlRef.current = null;
    setPendingUrl(null);
    setShowLogin(false);
    webViewRef.current?.injectJavaScript(navigation.script);
  };

  const clearStoredAuth = async () => {
    await CookieManager.clearAll();
    await SecureStore.deleteItemAsync('maeil1dok_access_token');
    await SecureStore.deleteItemAsync('maeil1dok_refresh_token');
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

  const restoreStoredSession = async (): Promise<boolean> => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync('maeil1dok_refresh_token');
      if (!storedRefreshToken) {
        return false;
      }

      // 본문 토큰을 제시하므로 서버는 이 요청에 CSRF 를 요구하지 않는다. 그래도
      // 헤더를 싣는다 — 서버 정책이 다시 조여지면 셸이 조용히 403 으로 죽는데,
      // 그 실패는 1시간 뒤에야 드러나고 원인도 보이지 않는다.
      const refreshCsrfCookies = await CookieManager.get(API_URL).catch(() => null);
      const response = await fetch(`${API_URL}/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeadersFrom(refreshCsrfCookies),
        },
        body: JSON.stringify({ refresh: storedRefreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        return abandonRestore(`refresh rejected with ${response.status}`);
      }

      const data = await response.json();
      if (!data.access || !data.refresh) {
        return abandonRestore('refresh response missing tokens');
      }

      const bridgeSuccess = await initiateSessionBridge(data.access, data.refresh);
      if (bridgeSuccess) {
        navigateToPendingUrl();
      }
      return bridgeSuccess;
    } catch (error) {
      console.error('[SessionRestore] Error:', error);
      return false;
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/email-login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.access) {
        const bridgeSuccess = await initiateSessionBridge(data.access, data.refresh);
        setShowLogin(false);
        if (bridgeSuccess) {
          navigateToPendingUrl();
        } else {
          setWebViewKey((prev) => prev + 1);
        }
      } else {
        Alert.alert('로그인 실패', data.error || '이메일 또는 비밀번호를 확인해주세요.');
      }
    } catch (error) {
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      const kakaoToken = await kakaoLogin();
      
      if (kakaoToken.accessToken) {
        setIsSubmitting(true);
        const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            provider: 'kakao', 
            access_token: kakaoToken.accessToken,
            auto_signup: true
          }),
          credentials: 'include',
        });

        const data = await response.json();

        if (data.access) {
          const bridgeSuccess = await initiateSessionBridge(data.access, data.refresh);
          setShowLogin(false);
          if (bridgeSuccess) {
            navigateToPendingUrl();
          } else {
            setWebViewKey((prev) => prev + 1);
          }
        } else if (data.needsSignup) {
          navigateToSocialSignup('kakao', data);
        } else {
          Alert.alert('로그인 실패', data.error || '로그인에 실패했습니다.');
        }
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
      if (!isErrorWithCode(error, 'E_CANCELLED_OPERATION')) {
        console.error('Kakao login error:', error);
        Alert.alert('오류', '카카오 로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const webRedirectUri = `${WEB_APP_URL}/auth/google/callback`;
      const state = encodeURIComponent(JSON.stringify({ from: 'app', scheme: APP_SCHEME }));
      const appRedirectUri = `${APP_SCHEME}://auth/google/callback`;
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(webRedirectUri)}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent&state=${state}`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirectUri);
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (code) {
          await handleSocialLoginCode('google', code, webRedirectUri);
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (credential.identityToken) {
        await handleAppleLoginWithToken(credential.identityToken, credential.fullName);
      }
    } catch (error) {
      if (!isErrorWithCode(error, 'ERR_REQUEST_CANCELED')) {
        Alert.alert('오류', 'Apple 로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleAppleLoginWithToken = async (
    identityToken: string, 
    fullName: AppleAuthentication.AppleAuthenticationFullName | null
  ) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'apple', 
          id_token: identityToken,
          full_name: fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() || undefined : undefined,
          auto_signup: true
        }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('[Apple Login] Response received');

      if (data.access) {
        console.log('[Apple Login] Auth response accepted');
        const bridgeSuccess = await initiateSessionBridge(data.access, data.refresh);
        console.log('[Apple Login] bridgeSuccess:', bridgeSuccess);
        setShowLogin(false);
        if (bridgeSuccess) {
          navigateToPendingUrl();
        } else {
          console.log('[Apple Login] Bridge failed, reloading WebView');
          setWebViewKey((prev) => prev + 1);
        }
      } else if (data.needsSignup) {
        console.log('[Apple Login] Needs signup');
        navigateToSocialSignup('apple', data);
      } else {
        console.log('[Apple Login] Login failed:', data.error);
        Alert.alert('로그인 실패', data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('[Apple Login] Error:', error);
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLoginCode = async (
    provider: SocialSignupProvider,
    code: string,
    redirectUri: string,
  ) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, code, redirect_uri: redirectUri }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.access) {
        const bridgeSuccess = await initiateSessionBridge(data.access, data.refresh);
        setShowLogin(false);
        if (bridgeSuccess) {
          navigateToPendingUrl();
        } else {
          setWebViewKey((prev) => prev + 1);
        }
      } else if (data.needsSignup) {
        navigateToSocialSignup(provider, data);
      } else {
        Alert.alert('로그인 실패', data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = () => {
    const url = `${WEB_APP_URL}/register-email`;
    pendingUrlRef.current = url;
    setPendingUrl(url);
    setShowLogin(false);
  };

  const handleForgotPassword = () => {
    const url = `${WEB_APP_URL}/auth/forgot-password`;
    pendingUrlRef.current = url;
    setPendingUrl(url);
    setShowLogin(false);
  };

  const handleDeepLink = useCallback((event: { url: string }) => {
    const target = buildDeepLinkNavigationUrl(event.url, WEB_APP_URL, APP_SCHEME);
    if (!target) return;
    webViewRef.current?.injectJavaScript(buildLocationAssignmentScript(target));
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    registerForPushNotifications();
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url as string | undefined;
        if (url) handleDeepLink({ url });
      }
    );
    return () => notificationSubscription.remove();
  }, [handleDeepLink]);

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      setPushToken(token.data);
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showLogin) {
          hideNativeLogin();
          return true;
        }
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  }, [canGoBack, showLogin]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('[WebView] NavigationState:', redactSensitiveUrl(navState.url), 'loading:', navState.loading);
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

  const handleLoadEnd = (syntheticEvent: WebViewUrlEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('[WebView] LoadEnd:', redactSensitiveUrl(nativeEvent?.url));
    setIsLoading(false);
    setIsError(false);
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

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'requestLogout':
          (async () => {
            try {
              // 1. 백엔드 로그아웃 API 호출
              // 서버는 refresh 쿠키가 있으면 CSRF 를 요구하는데, 네이티브 fetch 에는
              // Origin 도 Referer 도 없다. 공유 쿠키 저장소의 토큰을 직접 실어야
              // 통과한다 — 없이 보내면 403 이라 refresh 토큰이 블랙리스트되지 않고
              // 로그아웃이 서버에 붙지 않는다.
              const csrfCookies = await CookieManager.get(API_URL).catch(() => null);
              await fetch(`${API_URL}/api/v1/auth/logout/`, {
                method: 'POST',
                credentials: 'include',
                headers: csrfHeadersFrom(csrfCookies),
              });
            } catch (error) {
              console.error('Logout API error:', error);
            }
            
            await clearStoredAuth().catch((error) => {
              console.error('[Logout] Clear storage error:', error);
            });
            
            setWebViewKey(prev => prev + 1);
            showNativeLogin();
          })();
          break;
        case 'auth:request':
          restoreStoredSession().catch((error) => {
            console.error('[SessionRestore] Failed:', error);
          });
          break;
        case 'auth:logout':
        case 'auth:expired':
        case 'logout':
          clearStoredAuth().catch((error) => {
            console.error('[Logout] Clear storage error:', error);
          });
          setWebViewKey(prev => prev + 1);
          showNativeLogin();
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
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };

  const handleRetry = () => {
    setIsError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4B9F7E" />
        </View>
      </SafeAreaView>
    );
  }

  if (showLogin) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.loginBox}>
              <TouchableOpacity style={styles.backButton} onPress={hideNativeLogin}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>

              <View style={styles.logoContainer}>
                <Image 
                  source={require('./assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.socialButtons}>
                {Platform.OS === 'ios' && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={6}
                    style={styles.appleButton}
                    onPress={handleAppleLogin}
                  />
                )}

                <TouchableOpacity 
                  style={styles.kakaoButton} 
                  onPress={handleKakaoLogin}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Image 
                    source={require('./assets/kakao-icon.png')} 
                    style={styles.kakaoIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.googleButton} 
                  onPress={handleGoogleLogin}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Image 
                    source={require('./assets/google-icon.png')} 
                    style={styles.googleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>구글로 시작하기</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는 이메일로 계속</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, styles.inputTop]}
                  placeholder="이메일"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                <TextInput
                  style={[styles.input, styles.inputBottom]}
                  placeholder="비밀번호"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                onPress={handleEmailLogin}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? '로그인 중...' : '로그인'}
                </Text>
              </TouchableOpacity>

              <View style={styles.authLinks}>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotLink}>비밀번호를 잊으셨나요?</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRegister}>
                  <Text style={styles.registerLink}>이메일로 회원가입</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.bundleIdentityText}>
                {formatBundleIdentityLabel(bundleIdentity)}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
        javaScriptEnabled={true}
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
            document.body.classList.add('native-app');
            if (${Platform.OS === 'android'}) {
              document.body.classList.add('android-native-app');
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
  // Deliberately quiet: this is a diagnostic surface for the OTA reach test, not
  // product copy. It must be readable when asked for and ignorable otherwise.
  bundleIdentityText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
  },
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
  loginContainer: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginBox: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    gap: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#64748b',
    fontFamily: 'Pretendard-Regular',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    height: 32,
    width: 120,
  },
  socialButtons: {
    gap: 12,
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
  kakaoIcon: {
    width: 18,
    height: 18,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  kakaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    gap: 8,
  },
  kakaoButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#000000',
    letterSpacing: -0.8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  googleButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#1f2937',
    letterSpacing: -0.8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  dividerText: {
    fontFamily: 'Pretendard-Regular',
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#64748b',
    letterSpacing: -0.7,
  },
  inputGroup: {
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    fontFamily: 'Pretendard-Regular',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    letterSpacing: -0.8,
  },
  inputTop: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomWidth: 0,
  },
  inputBottom: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  submitButton: {
    backgroundColor: '#4B9F7E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: 'Pretendard-Medium',
    color: '#fff',
    fontSize: 14,
    letterSpacing: -0.8,
  },
  authLinks: {
    alignItems: 'center',
    gap: 8,
  },
  forgotLink: {
    fontFamily: 'Pretendard-Regular',
    color: '#64748b',
    fontSize: 14,
    letterSpacing: -0.7,
  },
  registerLink: {
    fontFamily: 'Pretendard-Medium',
    color: '#4B9F7E',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    letterSpacing: -0.7,
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

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
