/**
 * usePlanApi - 플랜 관련 API 호출 composable
 *
 * 플랜 구독, 조회, 관리 등 모든 플랜 관련 API를 중앙화
 */

import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useToast } from '~/composables/useToast';
import type { components } from '~/types/generated/api-schema';
import type {
  Plan,
  Subscription,
  SubscriptionSummary,
  UserPlansResponse,
} from '~/types/plan';

const normalizePlan = (plan: components['schemas']['BibleReadingPlan']): Plan => ({
  id: plan.id,
  name: plan.name,
  description: plan.description ?? '',
  is_default: plan.is_default ?? false,
  subscriber_count: plan.subscriber_count,
});

const normalizeSubscription = (
  subscription: components['schemas']['PlanSubscription'],
): Subscription => ({
  ...subscription,
  is_active: subscription.is_active ?? false,
});

export function usePlanApi() {
  const api = useApi();
  const { handleApiError } = useErrorHandler();
  const toast = useToast();

  // 중복 호출 방지 플래그
  const isFetchingUserPlans = ref(false);
  const isFetchingSubscriptions = ref(false);
  let pendingSubscriptions = 0;

  /**
   * 사용자 플랜 정보 조회 (구독 목록 + 구독 가능한 플랜)
   * /plans 페이지에서 사용
   */
  async function fetchUserPlans(): Promise<UserPlansResponse | null> {
    if (isFetchingUserPlans.value) return null;
    isFetchingUserPlans.value = true;

    try {
      const { data } = await api.GET('/api/v1/todos/plans/user/');

      return {
        subscriptions: data.subscriptions.map(normalizeSubscription),
        available_plans: data.available_plans.map(normalizePlan),
      };
    } catch (error) {
      handleApiError(error, '플랜 정보 조회');
      return null;
    } finally {
      isFetchingUserPlans.value = false;
    }
  }

  /**
   * 사용자 구독 정보만 조회 (간소화된 형태)
   * BibleScheduleContent에서 사용
   */
  async function fetchSubscriptions(
    options: { throwOnError?: boolean } = {},
  ): Promise<SubscriptionSummary[]> {
    // Preserve legacy suppression, but strict reads must resolve their own
    // identity's request instead of receiving a fabricated empty collection.
    if (isFetchingSubscriptions.value && !options.throwOnError) return [];
    pendingSubscriptions++;
    isFetchingSubscriptions.value = true;

    try {
      const { data } = await api.GET('/api/v1/todos/plan/');

      if (Array.isArray(data)) {
        return data;
      }
      if (options.throwOnError) throw new TypeError('Expected a subscription collection');
      return [];
    } catch (error) {
      handleApiError(error, '구독 정보 조회', { silent: true });
      if (options.throwOnError) throw error;
      return [];
    } finally {
      isFetchingSubscriptions.value = --pendingSubscriptions > 0;
    }
  }

  /** Whole-plan progress. The resource ID is a subscription ID, not a plan ID. */
  async function fetchPlanSummary(subscriptionId: number) {
    try {
      const { data } = await api.GET(
        api.path('/api/v1/todos/plan/{id}/summary/', { id: subscriptionId })
      );
      return data;
    } catch (error) {
      handleApiError(error, '플랜 진도 조회', { silent: true });
      return null;
    }
  }

  /**
   * 플랜 구독
   */
  async function subscribeToPlan(planId: number): Promise<boolean> {
    try {
      await api.POST('/api/v1/todos/plan/', { plan: planId });
      return true;
    } catch (error) {
      handleApiError(error, '플랜 구독');
      return false;
    }
  }

  /**
   * 플랜 활성화/비활성화 토글
   */
  async function togglePlanActive(subscriptionId: number): Promise<boolean> {
    try {
      await api.POST(
        api.path('/api/v1/todos/plan/{id}/toggle-active/', { id: subscriptionId })
      );
      return true;
    } catch (error) {
      handleApiError(error, '플랜 상태 변경');
      return false;
    }
  }

  /**
   * 플랜 구독 삭제
   */
  async function deletePlanSubscription(subscriptionId: number): Promise<boolean> {
    try {
      await api.DELETE(api.path('/api/v1/todos/plan/{id}/', { id: subscriptionId }));
      return true;
    } catch (error) {
      handleApiError(error, '플랜 삭제');
      return false;
    }
  }

  return {
    // 상태
    isFetchingUserPlans,
    isFetchingSubscriptions,

    // API 메서드
    fetchUserPlans,
    fetchSubscriptions,
    fetchPlanSummary,
    subscribeToPlan,
    togglePlanActive,
    deletePlanSubscription,
  };
}
