const assert = require('node:assert/strict');
const test = require('node:test');

const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

test('failed Android loadEnd does not dismiss the terminal retry state', () => {
  let isError = false;
  const common = {
    console: { log: () => {} },
    redactSensitiveUrl: url => url,
    setIsLoading: () => {},
    setIsError: value => { isError = value; },
    SplashScreen: { hideAsync: () => {} },
  };
  const handleError = instantiateClosure('handleError', {
    ...common,
    isFatalWebViewError: () => true,
    WEBVIEW_POLICY: {},
    Platform: { OS: 'android' },
    dnsRetryAvailableRef: { current: true },
  });
  const handleLoadEnd = instantiateClosure('handleLoadEnd', {
    ...common,
    firstLoadDoneRef: { current: false },
    injectPushToken: () => {},
    navigateToPendingUrl: () => {},
  });
  const event = {
    nativeEvent: {
      code: -2, description: 'net::ERR_INTERNET_DISCONNECTED',
      url: 'https://maeil1dok.app/bible?book=jhn&chapter=5',
    },
  };
  // react-native-webview forwards the failed completion after onError.
  handleError(event);
  assert.equal(isError, true);
  handleLoadEnd(event);
  assert.equal(isError, true);
});

for (const mounted of [false, true]) {
  test(`retry preserves the failed destination with WebView mounted=${mounted}`, () => {
    const queued = [];
    const errorStates = [];
    const firstLoadDoneRef = { current: true };
    let reloads = 0;
    const url = 'https://maeil1dok.app/bible?book=jhn&chapter=5';
    const retry = instantiateClosure('handleRetry', {
      setIsError: value => errorStates.push(value),
      setIsLoading: () => {},
      firstLoadDoneRef,
      currentWebViewUrlRef: { current: url },
      queuePendingUrl: value => queued.push(value),
      webViewRef: { current: mounted ? { reload: () => { reloads += 1; } } : null },
    });
    retry();
    assert.deepEqual(errorStates, [false]);
    assert.equal(firstLoadDoneRef.current, false);
    assert.deepEqual(queued, mounted ? [] : [url]);
    assert.equal(reloads, mounted ? 1 : 0);
  });
}

test('first iOS main-frame DNS failure remounts once before showing terminal error', () => {
  const observations = {
    errorStates: [],
    keyUpdates: [],
    loadingStates: [],
  };
  const dnsRetryAvailableRef = { current: true };
  const handleError = instantiateClosure('handleError', {
    console: { log: () => {} },
    redactSensitiveUrl: (url) => url,
    isFatalWebViewError: () => true,
    WEBVIEW_POLICY: {},
    Platform: { OS: 'ios' },
    dnsRetryAvailableRef,
    setIsLoading: (value) => observations.loadingStates.push(value),
    setIsError: (value) => observations.errorStates.push(value),
    setWebViewKey: (updater) => observations.keyUpdates.push(updater),
    SplashScreen: { hideAsync: () => {} },
  });
  const handleLoadEnd = instantiateClosure('handleLoadEnd', {
    console: { log: () => {} },
    redactSensitiveUrl: (url) => url,
    setIsLoading: () => {},
    setIsError: () => {},
    firstLoadDoneRef: { current: false },
    SplashScreen: { hideAsync: () => {} },
    injectPushToken: () => {},
    navigateToPendingUrl: () => {},
  });
  const handleLoad = instantiateClosure('handleLoad', {
    dnsRetryAvailableRef,
    webViewReadyRef: { current: false },
  });
  const event = {
    nativeEvent: {
      code: -1003,
      description: 'A server with the specified hostname could not be found.',
      url: 'https://maeil1dok.app/',
    },
  };

  handleError(event);
  assert.equal(observations.keyUpdates.length, 1);
  assert.equal(observations.errorStates.includes(true), false);
  assert.equal(dnsRetryAvailableRef.current, false);

  // onLoadEnd fires for failed loads too. It must not replenish the budget.
  handleLoadEnd(event);
  handleError(event);
  assert.equal(observations.keyUpdates.length, 1);
  assert.equal(observations.errorStates.at(-1), true);

  // A real successful document load opens one future recovery budget.
  handleLoad();
  handleError(event);
  assert.equal(observations.keyUpdates.length, 2);
  assert.equal(dnsRetryAvailableRef.current, false);
});
