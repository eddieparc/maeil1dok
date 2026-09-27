import type { components } from '../../app/types/generated/api-schema';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';

const subscriptions = [
  {
    plan_id: 101,
    plan_name: '처음 선택되는 플랜',
    is_default: true,
  },
  {
    plan_id: 202,
    plan_name: '마지막으로 이용한 플랜',
    is_default: false,
  },
] satisfies components['schemas']['PublicPlanSubscription'][];

const savedPlanSchedule = [
  {
    id: 20208,
    plan: 202,
    plan_name: '마지막으로 이용한 플랜',
    date: '2026-08-15',
    book: '요한복음',
    start_chapter: 3,
    end_chapter: 3,
    is_completed: false,
  },
] satisfies components['schemas']['DailyBibleScheduleWithProgress'][];

const septemberSchedule = [
  {
    id: 20209,
    plan: 202,
    plan_name: '마지막으로 이용한 플랜',
    date: '2026-09-02',
    book: '사도행전',
    start_chapter: 1,
    end_chapter: 2,
    is_completed: false,
  },
] satisfies components['schemas']['DailyBibleScheduleWithProgress'][];

const seedSavedPlan = async (page: Page): Promise<void> => {
  await page.clock.setFixedTime(new Date('2026-08-15T12:00:00+09:00'));
  await page.addInitScript(() => {
    localStorage.setItem('selectedPlanId', '202');
  });
};

const mockSchedulesByMonth = async (
  page: Page,
  schedulesByMonth: ReadonlyMap<
    number,
    components['schemas']['DailyBibleScheduleWithProgress'][]
  >,
): Promise<void> => {
  await page.route('**/api/v1/todos/schedules/month/**', async (route) => {
    const month = Number(new URL(route.request().url()).searchParams.get('month'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(schedulesByMonth.get(month) ?? []),
    });
  });
};

test('통독표는 마지막 이용 플랜을 자동 선택한다', async ({ api, page }) => {
  await seedSavedPlan(page);
  api.get('/api/v1/todos/plan/', subscriptions);
  api.get('/api/v1/todos/schedules/month/', savedPlanSchedule);

  await page.goto('/plan');

  await expect(page.getByRole('button', { name: '마지막으로 이용한 플랜' })).toBeVisible();
  await expect(page.getByText('요한복음 3장', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '처음 선택되는 플랜' })).toHaveCount(0);
});

test('마지막 일정 아래에서 다음 통독 일정의 월로 이동한다', async ({ api, page }) => {
  await seedSavedPlan(page);
  api.get('/api/v1/todos/plan/', subscriptions);
  await mockSchedulesByMonth(page, new Map([
    [8, savedPlanSchedule],
    [9, septemberSchedule],
  ]));

  await page.goto('/plan');
  await expect(page.getByText('요한복음 3장', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '다음 통독 일정으로' }).click();

  const septemberButton = page.getByRole('button', { name: '9월' });
  await expect(septemberButton).toHaveClass(/active/);
  await expect(page.getByText('사도행전 1-2장', { exact: true })).toBeVisible();
});

test('다음 달 일정이 없으면 더 이상 일정이 없다고 표시한다', async ({ api, page }) => {
  await seedSavedPlan(page);
  api.get('/api/v1/todos/plan/', subscriptions);
  await mockSchedulesByMonth(page, new Map([
    [8, savedPlanSchedule],
    [9, []],
  ]));

  await page.goto('/plan');

  await expect(page.getByText('이 시점 이후로는 더 이상 일정이 없어요', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 통독 일정으로' })).toHaveCount(0);
});

test('성경 리더 통독표 모달도 마지막 이용 플랜을 자동 선택한다', async ({ api, page }) => {
  await seedSavedPlan(page);
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  api.get('/api/v1/todos/plan/', subscriptions);
  api.get('/api/v1/todos/schedules/month/', savedPlanSchedule);

  await page.goto('/bible?book=jhn&chapter=3');
  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
  await page.getByRole('button', { name: '도구 메뉴' }).click();
  await page.getByRole('button', { name: '성경통독표' }).click();

  const scheduleDialog = page.getByRole('dialog');
  await expect(scheduleDialog.getByRole('heading', { name: '성경통독표' })).toBeVisible();
  await expect(scheduleDialog.getByRole('button', { name: '마지막으로 이용한 플랜' })).toBeVisible();
  await expect(scheduleDialog.getByText('요한복음 3장', { exact: true })).toBeVisible();
});
