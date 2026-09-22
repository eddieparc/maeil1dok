import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { initMobileTelemetry } from './sentryTelemetry';
import { formatBundleIdentityLine, resolveBundleIdentity } from './bundleIdentity';
import { buildDeepLinkNavigationUrl } from './deepLink';
import { mapWebPathToRoute } from './navigation/routeMap';
import { navigationRef } from './navigation/navigationRef';
import { AppStackProvider, useAppStack } from './navigation/AppStackContext';
import { WebViewControllerProvider, useWebViewController } from './screens/WebViewScreen';
import { AuthSessionProvider } from './auth/AuthSession';
import RootNavigator from './navigation/RootNavigator';
import { isPushBridgeOrigin, pushDestination } from './nativePush';

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

const APP_SCHEME = 'maeil1dok';

/**
 * Deep links and notification taps route through routeMap: paths with a native
 * home navigate to it, everything else keeps the old behaviour — the URL is
 * assigned into the running WebView (or queued onto it via route params).
 */
function ShellBody() {
  const { stack, betaMode } = useAppStack();
  const controller = useWebViewController();
  const WEB_APP_URL = stack.web;
  const currentWebViewUrlRef = useRef(WEB_APP_URL);
  currentWebViewUrlRef.current = WEB_APP_URL;
  const handledNotificationRef = useRef<string | null>(null);
  const lastNativePushTokenRef = useRef<string | null>(null);
  const pendingDeepLinkRef = useRef<string | null>(null);
  // The controller object is rebuilt every render; the ref lets the effects
  // below subscribe once instead of churning listeners on each render.
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  const handleDeepLink = useCallback((event: { url: string }) => {
    const target = buildDeepLinkNavigationUrl(event.url, WEB_APP_URL, APP_SCHEME);
    if (!target) return;
    if (!navigationRef.isReady()) {
      pendingDeepLinkRef.current = event.url;
      return;
    }

    let pathname = '/';
    let search = '';
    try {
      const parsed = new URL(target);
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      // buildDeepLinkNavigationUrl only returns parseable URLs; unreachable.
    }

    const route = mapWebPathToRoute(pathname, search);
    if (route.type === 'tab' && !search) {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', {
          screen: route.name,
          params: route.url ? { url: route.url } : undefined,
        });
      }
      return;
    }
    if (route.type === 'login') {
      controllerRef.current.showNativeLogin();
      return;
    }
    controllerRef.current.navigateToUrl(target);
  }, [WEB_APP_URL]);

  const handleNavigationReady = () => {
    const url = pendingDeepLinkRef.current;
    pendingDeepLinkRef.current = null;
    if (url) handleDeepLink({ url });
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    if (betaMode === null) return;
    let active = true;
    const receive = (response: Notifications.NotificationResponse) => {
      if (!active || !isPushBridgeOrigin(currentWebViewUrlRef.current, WEB_APP_URL)) return;
      const request = response.notification.request;
      if (handledNotificationRef.current === request.identifier) return;
      const url = pushDestination(request.content.data?.url, WEB_APP_URL, request.content.data?.origin);
      if (!url) return;
      handledNotificationRef.current = request.identifier;
      handleDeepLink({ url });
      void Notifications.clearLastNotificationResponseAsync();
    };
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(receive);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) receive(response);
    });
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      const identity = JSON.stringify([token.type, token.data]);
      if (lastNativePushTokenRef.current === identity) return;
      lastNativePushTokenRef.current = identity;
      void registerForPushNotifications();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerForPushNotifications();
    });
    return () => {
      active = false;
      notificationSubscription.remove();
      tokenSubscription.remove();
      foreground.remove();
    };
  }, [handleDeepLink, betaMode]);

  const registerForPushNotifications = () => controllerRef.current.registerForPushNotifications()
    .catch((error: unknown) => console.error('[NativePush] Foreground synchronization failed:', error));

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'Login') {
          controllerRef.current.hideNativeLogin();
          return true;
        }
        if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'WebView') {
          if (controllerRef.current.canGoBack) {
            controllerRef.current.goBack();
            return true;
          }
          return false;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  }, []);

  return <RootNavigator onReady={handleNavigationReady} />;
}

function AppContent() {
  const { ready, stack } = useAppStack();
  const [fontsLoaded, setFontsLoaded] = useState(false);

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
      try {
        await Font.loadAsync({
          'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
          'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
          'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
          'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
          'NotoSerifKR-Bold': require('./assets/fonts/NotoSerifKR-Bold.ttf'),
          'NotoSerifKR-Regular': require('./assets/fonts/NotoSerifKR-Regular.ttf'),
        });
      } catch (error) {
        console.warn('[App] font load failed:', error);
      } finally {
        setFontsLoaded(true);
        SplashScreen.hideAsync();
      }
    };
    loadFonts();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4B9F7E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthSessionProvider key={stack.web}>
      <WebViewControllerProvider bundleIdentity={bundleIdentity}>
        <ShellBody />
      </WebViewControllerProvider>
    </AuthSessionProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});

function App() {
  return (
    <SafeAreaProvider>
      <AppStackProvider>
        <AppContent />
      </AppStackProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
