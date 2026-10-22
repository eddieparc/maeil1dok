import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAppStack } from '../navigation/AppStackContext';
import type { RootStackParamList } from '../navigation/navigationRef';
import { NativeButton } from '../components/ui/NativeButton';
import { spacing, useNativeColors } from '../components/ui/tokens';
import { useWebViewController } from './WebViewScreen';

export default function StandaloneWebViewScreen() {
  const { stack } = useAppStack();
  const controller = useWebViewController();
  const route = useRoute<RouteProp<RootStackParamList, 'WebView'>>();
  const insets = useSafeAreaInsets();
  const colors = useNativeColors();
  const consumedUrl = useRef<string | null>(null);
  const { setWebViewMounted, queuePendingUrl, navigateToPendingUrl } = controller;

  useEffect(() => {
    setWebViewMounted(!controller.isError);
    return () => setWebViewMounted(false);
  }, [controller.isError, setWebViewMounted]);

  useEffect(() => {
    const url = route.params?.url;
    if (url && consumedUrl.current !== url) {
      consumedUrl.current = url;
      queuePendingUrl(url);
      navigateToPendingUrl();
    }
  }, [route.params?.url, queuePendingUrl, navigateToPendingUrl]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {controller.isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>연결할 수 없습니다</Text>
          <NativeButton label="다시 시도" onPress={controller.handleRetry} />
        </View>
      ) : (
        <WebView
          key={controller.webViewKey}
          ref={controller.webViewRef}
          source={{ uri: stack.web }}
          style={styles.container}
          onLoad={controller.handleLoad}
          onLoadEnd={event => {
            controller.handleLoadEnd(event);
            controller.consumePendingScript();
          }}
          onError={controller.handleError}
          onHttpError={controller.handleHttpError}
          onContentProcessDidTerminate={controller.handleRetry}
          onNavigationStateChange={controller.handleNavigationStateChange}
          onShouldStartLoadWithRequest={controller.handleShouldStartLoadWithRequest}
          onMessage={controller.handleMessage}
          injectedJavaScriptBeforeContentLoaded={`
            window.isReactNativeWebView = true;
            window.nativePushManaged = true;
            window.__shellBetaMode = true;
            window.isAndroidApp = ${Platform.OS === 'android'};
            true;
          `}
          injectedJavaScript={`
            (function() {
              window.isReactNativeWebView = true;
              window.nativePushManaged = true;
              window.__shellBetaMode = true;
              window.__shellBundleIdentity = ${JSON.stringify(controller.bundleIdentity)};
              window.isAndroidApp = ${Platform.OS === 'android'};
              window.nativeInsets = { top: ${insets.top}, bottom: ${insets.bottom}, left: ${insets.left}, right: ${insets.right} };
              window.requestNativePushToken = function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestPushToken' }));
              };
              document.documentElement.style.setProperty('--native-top-inset', '${insets.top}px');
              document.documentElement.style.setProperty('--native-bottom-inset', '${insets.bottom}px');
              if (document.body) {
                document.body.classList.add('native-app');
                if (${Platform.OS === 'android'}) document.body.classList.add('android-native-app');
              }
            })();
            true;
          `}
          javaScriptEnabled
          webviewDebuggingEnabled={__DEV__}
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          startInLoadingState
          scalesPageToFit
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          androidLayerType="hardware"
          decelerationRate={0.998}
          pullToRefreshEnabled={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFillObject, styles.center]}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
});
