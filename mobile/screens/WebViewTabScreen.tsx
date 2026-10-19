import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { useAppStack } from '../navigation/AppStackContext';
import { useAuth } from '../auth/AuthSession';
import { createTokenStore } from '../api/authTokens';
import { isPushBridgeOrigin, isPushBridgeRequest, nativePushStateScript } from '../nativePush';
import { NativePushOperationError } from '../nativePushLifecycle';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { BETA_STACK, PROD_STACK, resolveStack } from '../betaMode';
import { redactSensitiveUrl } from '../urlRedaction';
import { csrfHeadersFrom } from '../csrfHeader';
import { hasAuthCookies, runStoredSessionRestore } from '../sessionRestore';
import { buildNativeClientObservationHeaders } from '../clientObservationHeaders';
import { buildSessionBridgeConsumeUrl } from '../sessionBridgeNavigation';
import {
  buildAppleNativeLinkFailure,
  buildAppleNativeLinkSuccess,
  parseAppleNativeLinkRequest,
} from '../appleNativeLink';
import {
  isFatalWebViewError,
  resolveWebTabUrl,
  shouldAllowWebViewNavigation,
} from '../webviewNavigation';
import { useWebViewController } from './WebViewScreen';

const DECELERATION_RATE_NORMAL = 0.998;

const NATIVE_CLIENT_OBSERVATION_HEADERS = buildNativeClientObservationHeaders({
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  appVersion: Constants.expoConfig?.version,
});

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

/**
 * A web page living inside a bottom tab (함께, 내 정보). Unlike the stack
 * WebViewScreen it has no back button and no header — the tab bar is the
 * navigation. It owns its own <WebView> so tab state survives switching, and
 * hides the web app's own bottom nav (the native tab bar replaces it).
 */
export default function WebViewTabScreen({ path }: { readonly path: string }) {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<TabParamList, 'Together' | 'Profile'>>();
  const { stack, betaMode, setBetaMode } = useAppStack();
  const tokenStore = useMemo(() => createTokenStore(SecureStore, betaMode === true), [betaMode]);
  const { signOut, pushRuntime, status: authStatus } = useAuth();
  const controller = useWebViewController();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const firstLoadDoneRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const dnsRetryAvailableRef = useRef(true);
  const restoreGenerationRef = useRef(0);

  const WEB_APP_URL = stack.web;
  const API_URL = stack.api;
  const WEBVIEW_POLICY = {
    webAppUrl: WEB_APP_URL,
    apiUrl: API_URL,
    extraOrigins: [PROD_STACK.web, PROD_STACK.api, BETA_STACK.web, BETA_STACK.api],
  };

  const initialUrl = resolveWebTabUrl(WEB_APP_URL, route.params?.url ?? path);

  const injectUrl = useCallback((url: string) => {
    const webView = webViewRef.current;
    if (!webView || !firstLoadDoneRef.current) {
      pendingUrlRef.current = url;
      return;
    }
    webView.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  // A deep link that arrived while this tab was not focused lands as a route
  // param; consume it once per value so re-renders do not re-navigate.
  const consumedUrlParamRef = useRef<string | null>(null);
  useEffect(() => {
    const url = route.params?.url;
    if (url && consumedUrlParamRef.current !== url) {
      consumedUrlParamRef.current = url;
      injectUrl(resolveWebTabUrl(WEB_APP_URL, url));
    }
  }, [route.params?.url, WEB_APP_URL, injectUrl]);

  const showNativeLogin = useCallback(() => {
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'Login') {
      navigationRef.navigate('Login');
    }
  }, []);

  const initiateSessionBridge = useCallback(async (
    accessToken: string,
    refreshToken: string,
  ): Promise<boolean> => {
    try {
      await tokenStore.write({ access: accessToken, refresh: refreshToken });

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
      if (!issueResponse.ok) return false;

      const issueData = await issueResponse.json();
      const code = issueData.code;
      if (!code) return false;

      const consumeUrl = buildSessionBridgeConsumeUrl({
        apiUrl: API_URL,
        webAppUrl: WEB_APP_URL,
        code,
        currentUrl: currentUrlRef.current ?? initialUrl,
      });
      injectUrl(consumeUrl);
      return true;
    } catch (error) {
      console.error('[WebViewTab] Session bridge failed:', error);
      return false;
    }
  }, [API_URL, WEB_APP_URL, initialUrl, injectUrl, tokenStore]);

  const restoreStoredSession = useCallback((): Promise<boolean> => {
    const generation = restoreGenerationRef.current;
    return runStoredSessionRestore({
      apiUrl: API_URL,
      readRefreshToken: async () => (await tokenStore.read()).refresh,
      readCsrfHeaders: async () => {
        const refreshCookies = await CookieManager.get(API_URL).catch(() => null);
        return {
          ...NATIVE_CLIENT_OBSERVATION_HEADERS,
          ...csrfHeadersFrom(refreshCookies),
        };
      },
      fetchRefresh: (url, init) => fetch(url, init),
      initiateSessionBridge,
      navigateToPendingUrl: () => {
        const pending = pendingUrlRef.current;
        if (pending && firstLoadDoneRef.current) {
          pendingUrlRef.current = null;
          injectUrl(pending);
        }
      },
      abandonRestore: (reason) => {
        console.log(`[WebViewTab] restore abandoned: ${reason}`);
        return false;
      },
      reportError: (error) => console.error('[WebViewTab] restore error:', error),
      isRestoreCurrent: () => restoreGenerationRef.current === generation,
    });
  }, [API_URL, initiateSessionBridge, injectUrl, tokenStore]);

  const finishNativeLogout = useCallback(async () => {
    await signOut().catch((error) => {
      console.error('[WebViewTab] sign-out error:', error);
    });
    firstLoadDoneRef.current = false;
    setWebViewKey((previous) => previous + 1);
  }, [signOut]);

  const injectPushToken = useCallback(() => {
    if (controller.pushToken && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          window.nativePushToken = '${controller.pushToken}';
          window.dispatchEvent(new CustomEvent('nativePushToken', { detail: '${controller.pushToken}' }));
        })();
        true;
      `);
    }
  }, [controller.pushToken]);

  const handleAppleLinkRequest = async (state: string) => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
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

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    currentUrlRef.current = navState.url;
    if (navState.url.includes('/login') && navState.url.startsWith(WEB_APP_URL)) {
      showNativeLogin();
    }
  };

  const handleShouldStartLoadWithRequest = (request: { url: string; isTopFrame?: boolean }) => {
    const { url } = request;
    if (shouldAllowWebViewNavigation(request, WEBVIEW_POLICY)) {
      return true;
    }
    if (url.includes('/login') && url.startsWith(WEB_APP_URL)) {
      showNativeLogin();
      return false;
    }
    if (url.startsWith('youtube://') || url.startsWith('vnd.youtube://') || url.startsWith('intent://')) {
      Linking.openURL(url).catch(() => {
        const videoIdMatch = url.match(/[?&]v=([^&#]+)/);
        if (videoIdMatch) {
          Linking.openURL(`https://www.youtube.com/watch?v=${videoIdMatch[1]}`);
        }
      });
      return false;
    }
    return false;
  };

  const handleLoadEnd = (syntheticEvent: WebViewUrlEvent) => {
    setIsLoading(false);
    setIsError(false);
    firstLoadDoneRef.current = true;
    SplashScreen.hideAsync();
    injectPushToken();
    const pending = pendingUrlRef.current;
    if (pending) {
      pendingUrlRef.current = null;
      injectUrl(pending);
    }
  };

  const handleLoad = () => {
    dnsRetryAvailableRef.current = true;
  };

  const handleError = (syntheticEvent: WebViewErrorLikeEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.log('[WebViewTab] Error:', nativeEvent?.description, 'url:', redactSensitiveUrl(nativeEvent?.url));
    if (!isFatalWebViewError(nativeEvent, WEBVIEW_POLICY)) {
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
          if (!isPushBridgeOrigin(currentUrlRef.current ?? undefined, origin)) return;
          webViewRef.current?.injectJavaScript(nativePushStateScript(state));
        }).catch((error: unknown) => {
          if (!isPushBridgeOrigin(currentUrlRef.current ?? undefined, origin)) return;
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
        case 'auth:request':
          void restoreStoredSession();
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
        case 'requestLogout':
          restoreGenerationRef.current += 1;
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
          const enabled = message.enabled === true;
          const target = resolveStack(enabled);
          void (async () => {
            await setBetaMode(enabled);
            pendingUrlRef.current = null;
            currentUrlRef.current = target.web;
            firstLoadDoneRef.current = false;
            setIsLoading(true);
            setWebViewKey((previous) => previous + 1);
          })().catch((error) => console.error('[BetaMode] Switch failed:', error));
          break;
        }
      }
    } catch (error) {
      console.error('[WebViewTab] Failed to parse message:', error);
    }
  };

  const handleRetry = () => {
    setIsError(false);
    setIsLoading(true);
    firstLoadDoneRef.current = false;
    webViewRef.current?.reload();
  };

  if (isError) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
      <WebView
        key={`${webViewKey}:${initialUrl}`}
        ref={webViewRef}
        source={{ uri: initialUrl }}
        style={styles.webView}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
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
        webviewDebuggingEnabled={__DEV__}
        domStorageEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        startInLoadingState={true}
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
            window.nativeInsets = { top: ${insets.top}, bottom: 0, left: ${insets.left}, right: ${insets.right} };
            window.requestNativePushToken = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestPushToken' }));
            };
            document.documentElement.style.setProperty('--native-top-inset', '${insets.top}px');
            document.documentElement.style.setProperty('--native-bottom-inset', '0px');
            document.documentElement.style.setProperty('--mobile-nav-height', '0px');
            if (document.body) {
              document.body.classList.add('native-app');
              if (${Platform.OS === 'android'}) {
                document.body.classList.add('android-native-app');
              }
            }
            var style = document.getElementById('native-tab-nav-hide');
            if (!style) {
              style = document.createElement('style');
              style.id = 'native-tab-nav-hide';
              style.textContent = '.bottom-nav-container,.bottom-nav,.bottom-nav-tabs,.floating-nav{display:none!important}';
              (document.head || document.documentElement).appendChild(style);
            }
          })();
          true;
        `}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2A1111" />
          </View>
        )}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2A1111" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
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
    color: '#1F1A17',
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: '#6B625B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2A1111',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#fff',
    fontSize: 16,
  },
});
