const assert = require('node:assert/strict');
const test = require('node:test');

const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

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
    SplashScreen: { hideAsync: () => {} },
    injectPushToken: () => {},
    navigateToPendingUrl: () => {},
  });
  const handleLoad = instantiateClosure('handleLoad', {
    dnsRetryAvailableRef,
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
