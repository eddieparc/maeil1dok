import type { components } from '../../app/types/generated/api-schema';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/api';

const subscribedPlan = {
  id: 21,
  plan_id: 101,
  plan_name: '2026 매일 통독',
  is_active: true,
  is_default: true,
  start_date: '2026-01-01',
} satisfies components['schemas']['PlanSubscription'];

const availablePlan = {
  id: 102,
  name: '신약 90일 통독',
  description: '90일 동안 신약을 읽는 플랜',
  is_default: false,
  is_active: true,
  created_by: 1,
  created_by_username: 'admin',
  subscriber_count: 14,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} satisfies components['schemas']['BibleReadingPlan'];

const userPlans = {
  subscriptions: [subscribedPlan],
  available_plans: [availablePlan],
} satisfies components['schemas']['UserPlansResponse'];

const customSubscription = {
  id: 22,
  plan_id: 103,
  plan_name: '시편 묵상 플랜',
  is_active: true,
  is_default: false,
  start_date: '2026-02-01',
} satisfies components['schemas']['PlanSubscription'];

const jsonHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRFToken',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:3019',
};

const installStatefulPlanApi = async (
  page: Page,
  initialSubscriptions: components['schemas']['PlanSubscription'][],
  initialAvailablePlans: components['schemas']['BibleReadingPlan'][],
) => {
  const state = {
    subscriptions: initialSubscriptions.map((subscription) => ({ ...subscription })),
    availablePlans: initialAvailablePlans.map((plan) => ({ ...plan })),
  };

  await page.route('http://127.0.0.1:8019/api/v1/todos/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: jsonHeaders });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/todos/plans/user/') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify({
          subscriptions: state.subscriptions,
          available_plans: state.availablePlans,
        }),
      });
      return;
    }

    const summaryMatch = url.pathname.match(/^\/api\/v1\/todos\/plan\/(\d+)\/summary\/$/);
    if (request.method() === 'GET' && summaryMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify({ completed_days: 3, total_days: 10, percent: 30 }),
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/todos/plan/') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify(state.subscriptions),
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/todos/schedules/month/') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify([]),
      });
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/api/v1/todos/plan/') {
      const { plan: planId } = request.postDataJSON() as { plan: number };
      const plan = state.availablePlans.find((candidate) => candidate.id === planId);
      if (!plan) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          headers: jsonHeaders,
          body: JSON.stringify({ detail: '이미 구독 중인 플랜입니다.' }),
        });
        return;
      }

      const subscription = {
        id: 30,
        plan_id: plan.id,
        plan_name: plan.name,
        is_active: true,
        is_default: plan.is_default ?? false,
        start_date: '2026-08-29',
      };
      state.subscriptions.push(subscription);
      state.availablePlans = state.availablePlans.filter((candidate) => candidate.id !== planId);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify(subscription),
      });
      return;
    }

    const toggleMatch = url.pathname.match(/^\/api\/v1\/todos\/plan\/(\d+)\/toggle-active\/$/);
    if (request.method() === 'POST' && toggleMatch) {
      const subscription = state.subscriptions.find(
        (candidate) => candidate.id === Number(toggleMatch[1]),
      );
      if (!subscription) throw new Error(`Unknown subscription ${toggleMatch[1]}`);
      subscription.is_active = !subscription.is_active;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: jsonHeaders,
        body: JSON.stringify({ is_active: subscription.is_active }),
      });
      return;
    }

    const detailMatch = url.pathname.match(/^\/api\/v1\/todos\/plan\/(\d+)\/$/);
    if (request.method() === 'DELETE' && detailMatch) {
      state.subscriptions = state.subscriptions.filter(
        (candidate) => candidate.id !== Number(detailMatch[1]),
      );
      await route.fulfill({ status: 204, headers: jsonHeaders });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      headers: jsonHeaders,
      body: JSON.stringify({ detail: `${request.method()} ${url.pathname} is not mocked` }),
    });
  });

  return state;
};

test('authenticated reader sees subscription controls instead of the login prompt', async ({ api, page }) => {
  await api.authenticate();
  api.get('/api/v1/todos/plans/user/', userPlans);

  let releaseAuthRequest!: () => void;
  const authRequestHeld = new Promise<void>((resolve) => {
    releaseAuthRequest = resolve;
  });
  let markAuthRequestStarted!: () => void;
  const authRequestStarted = new Promise<void>((resolve) => {
    markAuthRequestStarted = resolve;
  });
  await page.route('http://127.0.0.1:8019/api/v1/auth/user/', async (route) => {
    markAuthRequestStarted();
    await authRequestHeld;
    await route.fallback();
  });

  await page.goto('/plans');
  await authRequestStarted;

  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.locator('[data-state="loading"]').first()).toBeVisible();
  await expect(page.locator('[data-state="guest"]')).toHaveCount(0);

  releaseAuthRequest();

  await expect(page.getByText('플랜을 구독하려면 로그인이 필요해요.')).toBeHidden();
  await expect(page.getByRole('heading', { name: '2026 매일 통독' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '신약 90일 통독' })).toBeVisible();
  await expect(page.getByRole('button', { name: '구독하기' })).toBeVisible();
});

test('guest sees the login prompt and can navigate to login', async ({ page }) => {
  await page.route('http://127.0.0.1:8019/api/v1/auth/user/', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: jsonHeaders,
      body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
    }));
  await page.goto('/plans');

  await expect(page.getByText('플랜을 구독하려면 로그인이 필요해요.')).toBeVisible();
  await page.getByRole('link', { name: '로그인하기' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('reader can subscribe, hide, restore, cancel deletion, and delete a plan', async ({ api, page }) => {
  await api.authenticate();
  await installStatefulPlanApi(
    page,
    [subscribedPlan, customSubscription],
    [availablePlan],
  );

  await page.goto('/plans');

  const subscribedSection = page.locator('.plan-section').nth(0);
  const availableSection = page.locator('.plan-section').nth(1);
  await expect(subscribedSection.locator('.count-badge')).toHaveText('2');
  await expect(availableSection.locator('.count-badge')).toHaveText('1');

  const subscribeRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/v1/todos/plan/');
  await availableSection.getByRole('button', { name: '구독하기' }).click();
  await subscribeRequest;
  await expect(page.getByText('신약 90일 통독 플랜을 구독했어요')).toBeVisible();
  await expect(subscribedSection.locator('.count-badge')).toHaveText('3');
  await expect(subscribedSection).toContainText('신약 90일 통독');
  await expect(availableSection).toContainText('현재 구독 가능한 플랜이 없어요.');

  const customCard = subscribedSection.locator('.plan-card').filter({ hasText: '시편 묵상 플랜' });
  const hideRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/v1/todos/plan/22/toggle-active/');
  await customCard.getByRole('button', { name: '숨기기' }).click();
  await hideRequest;
  await expect(page.getByText('시편 묵상 플랜을 숨겼어요')).toBeVisible();
  await expect(customCard).toContainText('숨김');
  await expect(customCard.getByRole('button', { name: '다시 보기' })).toBeVisible();
  await expect(customCard.getByRole('button', { name: '완전 삭제' })).toBeVisible();

  const restoreRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/v1/todos/plan/22/toggle-active/');
  await customCard.getByRole('button', { name: '다시 보기' }).click();
  await restoreRequest;
  await expect(page.getByText('시편 묵상 플랜을 다시 표시해요')).toBeVisible();
  await expect(customCard.getByRole('button', { name: '성경통독표' })).toBeVisible();
  await expect(customCard.getByRole('button', { name: '숨기기' })).toBeVisible();

  const secondHideRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/v1/todos/plan/22/toggle-active/');
  await customCard.getByRole('button', { name: '숨기기' }).click();
  await secondHideRequest;
  await customCard.getByRole('button', { name: '완전 삭제' }).click();

  const firstDialog = page.getByRole('dialog', { name: '플랜을 완전히 삭제할까요?' });
  await expect(firstDialog).toContainText('읽기 기록이 모두 삭제');
  await firstDialog.getByRole('button', { name: '취소' }).click();
  await expect(customCard).toBeVisible();

  await customCard.getByRole('button', { name: '완전 삭제' }).click();
  const confirmDialog = page.getByRole('dialog', { name: '플랜을 완전히 삭제할까요?' });
  const deleteRequest = page.waitForRequest((request) =>
    request.method() === 'DELETE'
    && new URL(request.url()).pathname === '/api/v1/todos/plan/22/');
  await Promise.all([
    deleteRequest,
    expect(page.getByText('시편 묵상 플랜을 완전히 삭제했어요')).toBeVisible(),
    confirmDialog.getByRole('button', { name: '완전 삭제' }).click(),
  ]);
  await expect(customCard).toBeHidden();
  await expect(subscribedSection.locator('.count-badge')).toHaveText('2');
});

test('active subscription opens its reading plan', async ({ api, page }) => {
  await api.authenticate();
  await installStatefulPlanApi(page, [subscribedPlan], []);
  await page.goto('/plans');

  const defaultCard = page.locator('.plan-card').filter({ hasText: subscribedPlan.plan_name });
  await expect(defaultCard.getByRole('button', { name: '숨기기' })).toHaveCount(0);
  await expect(defaultCard.getByRole('button', { name: '완전 삭제' })).toHaveCount(0);
  await defaultCard.getByRole('button', { name: '성경통독표' }).click();

  await expect(page).toHaveURL(`/plan?plan=${subscribedPlan.plan_id}`);
});
