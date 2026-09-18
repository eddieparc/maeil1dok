import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const source = await readFile(
  new URL('../app/utils/bibleTabs.ts', import.meta.url),
  'utf8',
);
const { code } = await esbuild.transform(source, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const {
  createTabsState,
  addTab,
  removeTab,
  activateTab,
  updateTabSnapshot,
  setBarVisible,
  parseTabsState,
  serializeTabsState,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const snapshot = (overrides = {}) => ({
  book: 'gen',
  chapter: 1,
  version: 'GAE',
  scrollPosition: 0,
  ...overrides,
});

test('createTabsState starts empty with hidden bar', () => {
  const state = createTabsState();
  assert.deepEqual(state.tabs, []);
  assert.equal(state.activeTabId, null);
  assert.equal(state.barVisible, false);
});

test('addTab appends a tab, activates it, and keeps its snapshot', () => {
  const state = createTabsState();
  const first = addTab(state, snapshot(), '창세기 1장');
  assert.equal(state.tabs.length, 1);
  assert.equal(state.activeTabId, first.id);
  assert.equal(state.tabs[0].label, '창세기 1장');
  assert.equal(state.tabs[0].snapshot.book, 'gen');

  const second = addTab(state, snapshot({ book: 'psa', chapter: 23 }), '시편 23편');
  assert.equal(state.tabs.length, 2);
  assert.equal(state.activeTabId, second.id);
  assert.notEqual(first.id, second.id);
});

test('activateTab switches the active tab id', () => {
  const state = createTabsState();
  const first = addTab(state, snapshot(), '창세기 1장');
  const second = addTab(state, snapshot({ book: 'psa', chapter: 23 }), '시편 23편');
  assert.equal(activateTab(state, first.id), true);
  assert.equal(state.activeTabId, first.id);
  assert.equal(activateTab(state, 'missing-id'), false);
  assert.equal(state.activeTabId, first.id);
  assert.ok(second.id);
});

test('removeTab deletes the tab and activates a neighbor when active closes', () => {
  const state = createTabsState();
  const a = addTab(state, snapshot(), '창세기 1장');
  const b = addTab(state, snapshot({ book: 'exo', chapter: 3 }), '출애굽기 3장');
  const c = addTab(state, snapshot({ book: 'psa', chapter: 23 }), '시편 23편');

  activateTab(state, b.id);
  const result = removeTab(state, b.id);
  assert.equal(result.removed, true);
  assert.equal(state.tabs.length, 2);
  // 닫힌 활성 탭의 다음 이웃(c)이 활성화된다
  assert.equal(state.activeTabId, c.id);

  // 마지막 탭을 닫으면 이전 이웃이 활성화된다
  activateTab(state, c.id);
  removeTab(state, c.id);
  assert.equal(state.activeTabId, a.id);

  // 전부 닫으면 activeTabId는 null
  removeTab(state, a.id);
  assert.equal(state.tabs.length, 0);
  assert.equal(state.activeTabId, null);
});

test('removeTab on unknown id is a no-op', () => {
  const state = createTabsState();
  addTab(state, snapshot(), '창세기 1장');
  const result = removeTab(state, 'nope');
  assert.equal(result.removed, false);
  assert.equal(state.tabs.length, 1);
});

test('updateTabSnapshot replaces snapshot and label of the active tab', () => {
  const state = createTabsState();
  const tab = addTab(state, snapshot(), '창세기 1장');
  updateTabSnapshot(state, tab.id, snapshot({ book: 'psa', chapter: 119, scrollPosition: 420 }), '시편 119편');
  assert.equal(state.tabs[0].snapshot.book, 'psa');
  assert.equal(state.tabs[0].snapshot.chapter, 119);
  assert.equal(state.tabs[0].snapshot.scrollPosition, 420);
  assert.equal(state.tabs[0].label, '시편 119편');
});

test('setBarVisible toggles bar visibility', () => {
  const state = createTabsState();
  setBarVisible(state, true);
  assert.equal(state.barVisible, true);
  setBarVisible(state, false);
  assert.equal(state.barVisible, false);
});

test('serialize/parse round-trips tabs, active id, and visibility', () => {
  const state = createTabsState();
  const a = addTab(state, snapshot({ scrollPosition: 300 }), '창세기 1장');
  addTab(state, snapshot({ book: 'psa', chapter: 23 }), '시편 23편');
  activateTab(state, a.id);
  setBarVisible(state, true);

  const restored = parseTabsState(serializeTabsState(state));
  assert.equal(restored.tabs.length, 2);
  assert.equal(restored.activeTabId, a.id);
  assert.equal(restored.barVisible, true);
  assert.equal(restored.tabs[1].snapshot.book, 'psa');
});

test('parseTabsState survives malformed and empty input', () => {
  assert.deepEqual(parseTabsState(null), createTabsState());
  assert.deepEqual(parseTabsState(''), createTabsState());
  assert.deepEqual(parseTabsState('{broken json'), createTabsState());
  assert.deepEqual(parseTabsState('{"tabs":"not-an-array"}'), createTabsState());
  // 탭은 있으나 activeTabId가 깨진 경우 첫 탭으로 복구
  const repaired = parseTabsState(JSON.stringify({
    tabs: [{ id: 't1', label: '창세기 1장', snapshot: snapshot() }],
    activeTabId: 'ghost',
    barVisible: true,
  }));
  assert.equal(repaired.activeTabId, 't1');
  assert.equal(repaired.barVisible, true);
});
