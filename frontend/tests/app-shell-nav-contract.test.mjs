import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 디자인 리프레시 네비게이션 셸(PR1) 계약: 모바일 5탭 + >=1024px 사이드바.
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const bottomNav = await read('../app/components/BottomNavigation.vue');
const sidebarNav = await read('../app/components/common/SidebarNav.vue');
const pageLayout = await read('../app/components/common/PageLayout.vue');

test('하단 탭바는 홈·성경·통독표·함께·내 정보 5탭이다', () => {
  for (const label of ['홈', '성경', '통독표', '함께', '내 정보']) {
    assert.match(bottomNav, new RegExp(label), `탭 라벨 ${label}`);
  }
  assert.match(bottomNav, /to="\/bible"|'\/bible'/);
  assert.match(bottomNav, /to="\/plan"|'\/plan'/);
  assert.match(bottomNav, /to="\/groups"|'\/groups'/);
  assert.match(bottomNav, /\/profile\/|'\/login'|"\/login"/);
  assert.doesNotMatch(bottomNav, /랭킹|>그룹</, '구 탭 라벨(랭킹/그룹)은 남기지 않는다');
});

test('하단 탭바는 Lucide 아이콘 22px 과 44px 히트영역을 쓴다', () => {
  assert.match(bottomNav, /@lucide\/vue/);
  assert.match(bottomNav, /:size="22"|size:\s*22/);
  assert.match(bottomNav, /min-height:\s*(44px|var\(--hit-min\))/);
});

test('사이드바는 240px 이고 1024px 이상에서만 보인다', () => {
  assert.match(sidebarNav, /(240px|var\(--sidebar-width\))/);
  assert.match(sidebarNav, /min-width:\s*1024px/);
  assert.match(sidebarNav, /@lucide\/vue/);
});

test('PageLayout 이 탭바와 사이드바를 감싼다', () => {
  assert.match(pageLayout, /SidebarNav/);
  assert.match(pageLayout, /BottomNavigation/);
});

test('네비게이션 컴포넌트에 이모지와 원시 hex 가 없다', () => {
  for (const [name, source] of [['BottomNavigation.vue', bottomNav], ['SidebarNav.vue', sidebarNav]]) {
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${name} 이모지`);
    const css = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${name} 원시 hex`);
  }
});
