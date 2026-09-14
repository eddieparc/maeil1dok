import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 디자인 리프레시 핸드오프(design_handoff_maeil1dok_refresh/tokens.css) 기준 토큰 계약.
const themes = await readFile(new URL('../app/assets/css/themes.css', import.meta.url), 'utf8');
const mainCss = await readFile(new URL('../app/assets/css/main.css', import.meta.url), 'utf8');

const darkStart = themes.indexOf('[data-theme="dark"]');
assert.ok(darkStart > 0, 'themes.css 에 [data-theme="dark"] 블록이 있어야 한다');
const lightSource = themes.slice(0, darkStart);
const darkSource = themes.slice(darkStart);

function lastValue(source, token) {
  const matches = [...source.matchAll(new RegExp(`\\${token}\\s*:\\s*([^;]+);`, 'g'))];
  return matches.length ? matches.at(-1)[1].trim().replace(/\s*\/\*.*$/, '').trim() : null;
}
const norm = (value) => (value ?? '').toLowerCase().replace(/\s+/g, ' ');

const lightExpectations = {
  '--color-bg-primary': '#faf8f5',
  '--color-bg-tertiary': '#f1efed',
  '--color-text-primary': '#1f1a17',
  '--color-text-secondary': '#6b625b',
  '--color-border-default': '#e9e4de',
  '--color-accent-primary': '#2a1111',
  '--color-accent-primary-light': '#f3eeee',
  '--color-accent-bg': '#f3eeee',
  '--color-success': '#2a1111',
  '--color-info': '#2a1111',
  '--color-schedule-completed-bg': '#2a1111',
  '--radius-control': '10px',
  '--radius-card': '20px',
  '--radius-sheet': '24px',
  '--radius-pill': '999px',
  '--radius-cell': '4px',
  '--duration-micro': '150ms',
  '--duration-standard': '250ms',
  '--duration-enter': '450ms',
  '--duration-sheet': '350ms',
  '--duration-pop': '350ms',
  '--ease-out-quint': 'cubic-bezier(0.23, 1, 0.32, 1)',
  '--ease-decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
  '--ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  '--stagger': '50ms',
  '--tracking-body': '-0.4px',
  '--tracking-display': '-0.6px',
  '--screen-gutter': '20px',
  '--card-padding': '20px',
  '--appbar-height': '52px',
  '--tabbar-height': '84px',
  '--sidebar-width': '240px',
  '--content-max': '760px',
  '--aside-width': '300px',
  '--hit-min': '44px',
  '--color-highlight-yellow': '#f5de8a',
  '--color-highlight-green': '#bfd9b5',
  '--color-highlight-blue': '#bcd3ee',
  '--color-highlight-pink': '#f1c5cf',
  '--color-apple-bg': '#1f1a17',
  '--shadow-card': '0 1px 2px rgba(0, 0, 0, 0.04)',
  '--shadow-card-hover': '0 6px 16px rgba(20, 16, 12, 0.08)',
  '--shadow-cta': '0 6px 18px rgba(20, 16, 12, 0.12)',
  '--shadow-sheet': '0 -12px 32px rgba(0, 0, 0, 0.12)',
  '--bible-bg': '#faf8f5',
  '--verse-number-color': '#2a1111',
};

const darkExpectations = {
  '--color-accent-primary': '#f3eeee',
  '--color-accent-primary-light': '#3a2a2a',
  '--color-accent-bg': '#3a2a2a',
  '--color-text-inverse': '#1f1a17',
  '--color-schedule-completed-bg': '#f3eeee',
  '--color-schedule-completed-text': '#2a1111',
  '--color-success': '#f3eeee',
  '--color-info': '#f3eeee',
  '--shadow-card': 'none',
  '--color-input-focus': '#f3eeee',
};

test('라이트 테마 토큰이 핸드오프 tokens.css 값과 일치한다', () => {
  for (const [token, expected] of Object.entries(lightExpectations)) {
    assert.equal(norm(lastValue(lightSource, token)), norm(expected), `light ${token}`);
  }
});

test('다크 테마 토큰이 핸드오프 tokens.css 값과 일치한다', () => {
  for (const [token, expected] of Object.entries(darkExpectations)) {
    assert.equal(norm(lastValue(darkSource, token)), norm(expected), `dark ${token}`);
  }
});

test('main.css 가 본문 자간과 프레스/스태거/시머 유틸리티를 제공한다', () => {
  assert.match(mainCss, /letter-spacing:\s*var\(--tracking-body\)|letter-spacing:\s*-0\.4px/);
  assert.doesNotMatch(mainCss, /letter-spacing:\s*-0\.05em/, '레거시 -0.05em 자간은 제거한다');
  assert.match(mainCss, /\.press[^{]*\{[^}]*scale\(0?\.97\)/s);
  assert.match(mainCss, /\.fade-in/);
  assert.match(mainCss, /var\(--duration-enter\)|450ms/);
  assert.match(mainCss, /var\(--ease-out-quint\)|cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(mainCss, /--stagger|stagger/);
  assert.match(mainCss, /'Pretendard|Pretendard Variable|var\(--font-sans\)/);
});
