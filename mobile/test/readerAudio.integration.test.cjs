const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

// Native host boundary only. This is not a React mount or device rendering test.
function harness() {
  let slots = [], cursor = 0, effects = [], previousKey;
  const injections = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
        slots[index] = { deps, value: fn() };
      }
      return slots[index].value;
    },
    useEffect: effect,
    useLayoutEffect: effect,
  };
  function effect(fn, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
      slots[index]?.cleanup?.();
      slots[index] = { deps };
      effects.push(() => { slots[index].cleanup = fn(); });
    }
  }
  function disposeChild() {
    slots.slice(1).forEach(slot => slot?.cleanup?.());
    slots = slots.slice(0, 1);
  }
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const exports = {};
    const requireLocal = name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react-native') return {
        View: 'View', Text: 'Text', Modal: 'Modal', Pressable: 'Pressable',
        TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
        StyleSheet: { create: x => x, absoluteFillObject: {} },
      };
      if (name === 'react-native-webview') return { WebView: 'WebView' };
      if (name.startsWith('@expo/vector-icons')) return { __esModule: true, default: 'Icon' };
      if (name.startsWith('.')) return load(path.relative(path.join(__dirname, '..'), path.resolve(path.dirname(file), name + '.ts')));
      return require(name);
    };
    new Function('require', 'exports', output)(requireLocal, exports);
    cache.set(file, exports);
    return exports;
  }
  const Player = load('components/bible/ReaderAudioPlayer.tsx').default;
  return {
    injections,
    render(props) {
      cursor = 0;
      let tree = Player(props);
      // Resolve the keyed session child, keeping native hosts opaque.
      if (tree && typeof tree.type === 'function') {
        if (previousKey !== tree.key) { disposeChild(); previousKey = tree.key; }
        tree = tree.type(tree.props);
      } else if (!tree) { disposeChild(); previousKey = undefined; }
      const nodes = [];
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        nodes.push(node);
        if (node.type === 'WebView' && node.props.ref) {
          node.props.ref.current = { injectJavaScript: script => injections.push(script) };
        }
        walk(node.props?.children);
      }
      walk(tree);
      effects.splice(0).forEach(fn => fn());
      return { nodes, web: nodes.find(n => n.type === 'WebView'), tree };
    },
    dispose() { disposeChild(); slots = []; },
  };
}

function mediaDocument(html) {
  const messages = [], calls = [], timers = new Map();
  let handlers;
  const player = {
    getCurrentTime: () => 30, getDuration: () => 120,
    setPlaybackRate: rate => calls.push(['rate', rate]),
    playVideo: () => calls.push(['play']), pauseVideo: () => calls.push(['pause']),
    seekTo: (...args) => calls.push(['seek', ...args]), destroy: () => calls.push(['destroy']),
  };
  const listeners = {};
  const sandbox = {
    window: { ReactNativeWebView: { postMessage: data => messages.push(JSON.parse(data)) }, addEventListener(name, fn) { listeners[name] = fn; } },
    document: { createElement: () => ({}), head: { appendChild() {} } },
    YT: { Player: function (_, options) { handlers = options.events; return player; } },
    setInterval: fn => { timers.set(1, fn); return 1; }, clearInterval: id => timers.delete(id),
  };
  vm.createContext(sandbox);
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], sandbox);
  vm.runInContext('onYouTubeIframeAPIReady()', sandbox);
  return { messages, calls, timers, sandbox, handlers, listeners };
}

const props = { visible: true, audioLink: 'https://youtu.be/dQw4w9WgXcQ', contextKey: 'user:plan:gen:1', onClose() {} };

test('YouTube ready, not document load, reaches native controls', () => {
  const h = harness();
  const first = h.render(props);
  const media = mediaDocument(first.web.props.source.html);
  media.handlers.onReady();
  assert.equal(media.messages[0]?.type, 'ready', 'real player ready must cross the bridge');
  assert.equal(typeof first.web.props.onMessage, 'function');
  first.web.props.onMessage({ nativeEvent: { data: JSON.stringify(media.messages[0]) } });
  const ready = h.render(props);
  assert.equal(ready.nodes.filter(n => n.type === 'ActivityIndicator').length, 0);
  assert.equal(ready.nodes.filter(n => n.type === 'Modal').length, 0);
  h.dispose();
});

function send(web, message) {
  web.props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
}
function node(view, id) {
  const found = view.nodes.find(n => n.props.testID === id);
  assert.ok(found, id);
  return found;
}
function setup(overrides = {}) {
  const h = harness(), input = { ...props, ...overrides };
  const first = h.render(input), media = mediaDocument(first.web.props.source.html);
  media.handlers.onReady();
  send(first.web, media.messages[0]);
  return { h, input, first, media, binding: media.messages[0] };
}

test('time and play/pause/seek/rate controls use the player bridge without reloading media', () => {
  const rates = [];
  const { h, input, first, media, binding } = setup({ initialRate: 0.75, onRateChange: rate => rates.push(rate) });
  send(first.web, { ...binding, type: 'time', currentTime: 45, duration: 180 });
  send(first.web, { ...binding, type: 'state', state: 1 });
  let view = h.render(input);
  assert.deepEqual(node(view, 'audio-time').props.children, ['0:45', ' / ', '3:00']);
  node(view, 'audio-play').props.onPress();
  node(view, 'audio-seek').props.onLayout({ nativeEvent: { layout: { width: 200 } } });
  node(view, 'audio-seek').props.onPress({ nativeEvent: { locationX: 100 } });
  node(view, 'audio-speed').props.onPress();
  view = h.render(input);
  node(view, 'audio-rate-1.5').props.onPress();
  send(first.web, { ...binding, type: 'state', state: 2 });
  view = h.render(input);
  node(view, 'audio-play').props.onPress();
  for (const script of h.injections) vm.runInContext(script, media.sandbox);
  assert.ok(media.calls.some(call => call[0] === 'pause'));
  assert.ok(media.calls.some(call => call[0] === 'play'));
  assert.ok(media.calls.some(call => call[0] === 'seek' && call[1] === 90 && call[2] === true));
  assert.ok(media.calls.some(call => call[0] === 'rate' && call[1] === 1.5));
  assert.deepEqual(rates, [1.5]);
  assert.strictEqual(view.web.props.source, first.web.props.source);
  h.dispose();
});

test('ended emits once and only for the active link/context/generation', () => {
  const completions = [];
  const { h, input, first, binding } = setup({ onEnded: source => completions.push(source) });
  for (const mismatch of [{ link: 'other' }, { contextKey: 'other' }, { generation: -1 }]) {
    send(first.web, { ...binding, type: 'ended', ...mismatch });
  }
  assert.equal(completions.length, 0);
  send(first.web, { ...binding, type: 'ended' });
  send(first.web, { ...binding, type: 'ended' });
  assert.deepEqual(completions, [{ link: input.audioLink, contextKey: input.contextKey, generation: binding.generation }]);
  h.dispose();
  send(first.web, { ...binding, type: 'ended' });
  assert.equal(completions.length, 1);
});

test('context replacement and hide/reopen invalidate old callbacks and reset playback state', () => {
  const completions = [];
  const { h, input, first, binding } = setup({ onEnded: source => completions.push(source) });
  const next = { ...input, contextKey: 'user:plan:gen:2' };
  const replaced = h.render(next);
  send(first.web, { ...binding, type: 'ended' });
  send(first.web, { ...binding, type: 'error', code: 100 });
  assert.equal(completions.length, 0);
  assert.equal(node(replaced, 'audio-play').props.disabled, true);
  assert.notEqual(replaced.web.props.source.html, first.web.props.source.html);
  assert.equal(h.render({ ...next, visible: false }).web, undefined);
  const reopened = h.render(next);
  assert.notEqual(reopened.web.props.source.html, replaced.web.props.source.html);
  h.dispose();
});

test('close removes media even before parent visibility changes and ignores late events', () => {
  let closes = 0, ends = 0;
  const { h, input, first, binding } = setup({ onClose: () => closes++, onEnded: () => ends++ });
  const close = node(h.render(input), 'audio-close').props.onPress;
  close(); close();
  assert.equal(h.render(input).web, undefined);
  send(first.web, { ...binding, type: 'ended' });
  assert.equal(closes, 1);
  assert.equal(ends, 0);
  h.dispose();
});

test('real YouTube error removes media and retry creates a new loading instance', () => {
  const { h, input, first, media } = setup();
  media.handlers.onError({ data: 150 });
  send(first.web, media.messages.at(-1));
  let view = h.render(input);
  assert.equal(view.web, undefined);
  node(view, 'audio-retry').props.onPress();
  view = h.render(input);
  assert.ok(view.web);
  assert.notEqual(view.web.props.source.html, first.web.props.source.html);
  assert.equal(node(view, 'audio-play').props.disabled, true);
  h.dispose();
});

test('YouTube clock/state/ended events and disposal execute in the actual embedded script', () => {
  const { h, media } = setup();
  media.timers.get(1)();
  assert.equal(media.messages.at(-1).type, 'time');
  assert.equal(media.messages.at(-1).currentTime, 30);
  media.handlers.onStateChange({ data: 0 });
  assert.deepEqual(media.messages.slice(-3).map(event => event.type), ['state', 'time', 'ended']);
  media.listeners.pagehide();
  const count = media.messages.length;
  media.handlers.onError({ data: 100 });
  assert.equal(media.messages.length, count);
  assert.equal(media.timers.size, 0);
  assert.ok(media.calls.some(call => call[0] === 'destroy'));
  h.dispose();
});

test('rate selection before player ready is deferred and the latest rate is applied on ready', () => {
  const h = harness();
  const first = h.render(props);
  const media = mediaDocument(first.web.props.source.html);
  vm.runInContext("window.__readerAudio('rate', 1.25); window.__readerAudio('rate', 1.5);", media.sandbox);
  assert.deepEqual(media.calls, [], 'no player methods may run before YouTube ready');
  media.handlers.onReady();
  assert.deepEqual(media.calls, [['rate', 1.5], ['play']]);
  assert.equal(media.messages[0].type, 'ready');
  h.dispose();
});

test('late clock and state callbacks never read a destroyed player', () => {
  const { h, media } = setup();
  const clock = media.timers.get(1);
  vm.runInContext(`
    ytPlayer.getCurrentTime = function() { throw new Error('read destroyed player'); };
    ytPlayer.getDuration = function() { throw new Error('read destroyed player'); };
  `, media.sandbox);
  media.listeners.pagehide();
  assert.doesNotThrow(() => {
    clock();
    media.handlers.onStateChange({ data: 0 });
  });
  h.dispose();
});

test('non-YouTube fallback stays native and navigation policy blocks Bible pages', () => {
  const opened = [], h = harness();
  const fallback = h.render({ ...props, audioLink: 'https://example.org/audio', onOpenExternal: url => opened.push(url) });
  assert.equal(fallback.web, undefined);
  fallback.nodes.find(n => n.type === 'Pressable' && !n.props.testID).props.onPress();
  assert.deepEqual(opened, ['https://example.org/audio']);
  h.dispose();
  const actual = harness(), view = actual.render(props);
  const policy = view.web.props.onShouldStartLoadWithRequest;
  for (const url of ['https://maeil1dok.app/bible', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.example/embed/abc']) {
    assert.equal(policy({ url }), false);
  }
  assert.equal(policy({ url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }), true);
  actual.dispose();
});
