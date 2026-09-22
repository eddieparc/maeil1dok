const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// api/readerTabs.ts imports ./bibleBooks — register a .ts loader so the
// transpiled CommonJS require() can resolve it (same as scheduleData.test.cjs).
require.extensions['.ts'] = (moduleInstance, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  moduleInstance._compile(transpiled.outputText, filename);
};

function loadTsModule(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  READER_TABS_STORAGE_KEY,
  createTabsState,
  addTab,
  activateTab,
  removeTab,
  updateTabSnapshot,
  setBarVisible,
  serializeTabsState,
  parseTabsState,
  loadReaderTabs,
  saveReaderTabs,
} = loadTsModule('api/readerTabs.ts');

const snap = (overrides = {}) => ({
  book: 'gen',
  chapter: 1,
  version: 'GAE',
  scrollPosition: 0,
  ...overrides,
});

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: async (key) => (map.has(key) ? map.get(key) : null),
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
};

// --- addTab / activateTab ---------------------------------------------------

test('addTab appends a tab, activates it, and gives unique ids', () => {
  const state = createTabsState();
  const first = addTab(state, snap(), '창세기 1장');
  const second = addTab(state, snap({ book: 'psa', chapter: 23 }), '시편 23편');
  assert.equal(state.tabs.length, 2);
  assert.equal(state.activeTabId, second.id);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(state.tabs[0].snapshot, snap());
});

test('activateTab switches the active id and rejects unknown ids', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), 'a');
  const b = addTab(state, snap({ chapter: 2 }), 'b');
  assert.equal(activateTab(state, a.id), true);
  assert.equal(state.activeTabId, a.id);
  assert.equal(activateTab(state, 'tab-does-not-exist'), false);
  assert.equal(state.activeTabId, a.id);
  assert.equal(activateTab(state, b.id), true);
  assert.equal(state.activeTabId, b.id);
});

// --- removeTab ---------------------------------------------------------------

test('removeTab on an inactive tab keeps the active tab unchanged', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), 'a');
  const b = addTab(state, snap({ chapter: 2 }), 'b');
  const c = addTab(state, snap({ chapter: 3 }), 'c'); // active = c
  const result = removeTab(state, a.id);
  assert.equal(result.removed, true);
  assert.equal(result.activated, null);
  assert.equal(state.activeTabId, c.id);
  assert.equal(state.tabs.length, 2);
  assert.deepEqual(state.tabs.map((t) => t.id), [b.id, c.id]);
});

test('removeTab on the active tab activates the next neighbor', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), 'a');
  const b = addTab(state, snap({ chapter: 2 }), 'b');
  const c = addTab(state, snap({ chapter: 3 }), 'c');
  activateTab(state, b.id);
  const result = removeTab(state, b.id);
  assert.equal(result.removed, true);
  assert.equal(result.activated?.id, c.id);
  assert.equal(state.activeTabId, c.id);
  assert.deepEqual(state.tabs.map((t) => t.id), [a.id, c.id]);
});

test('removeTab on the active last-position tab activates the previous neighbor', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), 'a');
  const b = addTab(state, snap({ chapter: 2 }), 'b');
  activateTab(state, b.id);
  const result = removeTab(state, b.id);
  assert.equal(result.removed, true);
  assert.equal(result.activated?.id, a.id);
  assert.equal(state.activeTabId, a.id);
});

test('removeTab refuses to close the last remaining tab', () => {
  const state = createTabsState();
  const only = addTab(state, snap(), 'only');
  const result = removeTab(state, only.id);
  assert.equal(result.removed, false);
  assert.equal(result.activated, null);
  assert.equal(state.tabs.length, 1);
  assert.equal(state.activeTabId, only.id);
});

test('removeTab on an unknown id is a no-op', () => {
  const state = createTabsState();
  addTab(state, snap(), 'a');
  const result = removeTab(state, 'tab-nope');
  assert.equal(result.removed, false);
  assert.equal(result.activated, null);
  assert.equal(state.tabs.length, 1);
});

// --- updateTabSnapshot / setBarVisible ---------------------------------------

test('updateTabSnapshot rewrites snapshot and label of the target tab only', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), 'a');
  const b = addTab(state, snap({ chapter: 2 }), 'b');
  updateTabSnapshot(state, a.id, snap({ book: 'exo', chapter: 20, scrollPosition: 0.5 }), '출애굽기 20장');
  assert.equal(state.tabs[0].label, '출애굽기 20장');
  assert.deepEqual(state.tabs[0].snapshot, snap({ book: 'exo', chapter: 20, scrollPosition: 0.5 }));
  assert.equal(state.tabs[1].label, 'b');
  updateTabSnapshot(state, 'tab-nope', snap(), 'x'); // no-op, no throw
  assert.equal(state.tabs.length, 2);
});

test('setBarVisible toggles the strip flag', () => {
  const state = createTabsState();
  assert.equal(state.barVisible, false);
  setBarVisible(state, true);
  assert.equal(state.barVisible, true);
  setBarVisible(state, false);
  assert.equal(state.barVisible, false);
});

// --- serialize / parse (malformed saved state) --------------------------------

test('serialize → parse round-trips tabs, active id, and visibility', () => {
  const state = createTabsState();
  const a = addTab(state, snap(), '창세기 1장');
  addTab(state, snap({ book: 'psa', chapter: 23, scrollPosition: 0.4 }), '시편 23편');
  activateTab(state, a.id);
  setBarVisible(state, true);
  const restored = parseTabsState(serializeTabsState(state));
  assert.deepEqual(restored, state);
});

test('parseTabsState returns an empty state for null/empty/non-JSON input', () => {
  for (const raw of [null, '', 'not json', '{broken', '[]', '42', '"x"', '{}']) {
    const parsed = parseTabsState(raw);
    assert.deepEqual(parsed.tabs, [], `must be empty: ${JSON.stringify(raw)}`);
    assert.equal(parsed.activeTabId, null);
    assert.equal(parsed.barVisible, false);
  }
});

test('parseTabsState drops malformed tabs and keeps valid ones', () => {
  const raw = JSON.stringify({
    tabs: [
      { id: 'ok-1', label: '창세기 1장', snapshot: snap() },
      { id: 'bad-book', label: 'x', snapshot: snap({ book: 'narnia' }) },
      { id: 'bad-chapter', label: 'x', snapshot: snap({ chapter: 999 }) },
      { id: 'bad-chapter-type', label: 'x', snapshot: snap({ chapter: '1' }) },
      { id: 'bad-scroll', label: 'x', snapshot: snap({ scrollPosition: 1.5 }) },
      { id: 'bad-scroll-nan', label: 'x', snapshot: snap({ scrollPosition: NaN }) },
      { id: 'bad-version', label: 'x', snapshot: { ...snap(), version: 7 } },
      { label: 'no id', snapshot: snap() },
      { id: 'no-label', snapshot: snap() },
      'garbage',
      null,
    ],
    activeTabId: 'ok-1',
    barVisible: true,
  });
  const parsed = parseTabsState(raw);
  assert.equal(parsed.tabs.length, 1);
  assert.equal(parsed.tabs[0].id, 'ok-1');
  assert.equal(parsed.activeTabId, 'ok-1');
  assert.equal(parsed.barVisible, true);
});

test('parseTabsState repairs a dangling activeTabId to the first tab', () => {
  const raw = JSON.stringify({
    tabs: [
      { id: 't1', label: 'a', snapshot: snap() },
      { id: 't2', label: 'b', snapshot: snap({ chapter: 2 }) },
    ],
    activeTabId: 'ghost',
    barVisible: true,
  });
  const parsed = parseTabsState(raw);
  assert.equal(parsed.activeTabId, 't1');
});

test('parseTabsState accepts fractional chapter rejection and boundary scroll', () => {
  const raw = JSON.stringify({
    tabs: [
      { id: 'frac', label: 'x', snapshot: snap({ chapter: 1.5 }) },
      { id: 'edge', label: 'y', snapshot: snap({ scrollPosition: 1 }) },
    ],
    activeTabId: 'edge',
    barVisible: false,
  });
  const parsed = parseTabsState(raw);
  assert.deepEqual(parsed.tabs.map((t) => t.id), ['edge']);
  assert.equal(parsed.activeTabId, 'edge');
});

// --- AsyncStorage persistence -------------------------------------------------

test('saveReaderTabs then loadReaderTabs restores the state', async () => {
  const storage = memoryStorage();
  const state = createTabsState();
  addTab(state, snap(), '창세기 1장');
  addTab(state, snap({ book: 'mat', chapter: 5, scrollPosition: 0.25 }), '마태복음 5장');
  setBarVisible(state, true);
  await saveReaderTabs(storage, state);
  assert.equal(typeof storage.map.get(READER_TABS_STORAGE_KEY), 'string');
  const restored = await loadReaderTabs(storage);
  assert.deepEqual(restored, state);
});

test('loadReaderTabs survives malformed stored JSON', async () => {
  const storage = memoryStorage({ [READER_TABS_STORAGE_KEY]: '{not json' });
  const restored = await loadReaderTabs(storage);
  assert.deepEqual(restored, createTabsState());
});

test('loadReaderTabs survives storage read failure', async () => {
  const storage = {
    getItem: async () => {
      throw new Error('disk gone');
    },
    setItem: async () => {},
  };
  const restored = await loadReaderTabs(storage);
  assert.deepEqual(restored, createTabsState());
});

test('saveReaderTabs swallows storage write failure', async () => {
  const storage = {
    getItem: async () => null,
    setItem: async () => {
      throw new Error('read-only');
    },
  };
  const state = createTabsState();
  addTab(state, snap(), 'a');
  await saveReaderTabs(storage, state); // must not throw
});
