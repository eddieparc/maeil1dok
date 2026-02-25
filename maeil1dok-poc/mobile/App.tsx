import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

const WEBVIEW_URL = 'http://192.168.0.6:3001';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(WEBVIEW_URL);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('Navigation:', navState.url);
    setCurrentUrl(navState.url);
  };

  const handleLoadStart = () => {
    setLoading(true);
    console.log('WebView load started');
  };

  const handleLoadEnd = () => {
    setLoading(false);
    console.log('WebView load ended');
  };

  const handleError = (error: any) => {
    console.error('WebView error:', error);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerText}>Maeil1Dok WebView</Text>
        <Text style={styles.urlText} numberOfLines={1}>{currentUrl}</Text>
      </View>
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: WEBVIEW_URL }}
        style={styles.webview}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  urlText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
