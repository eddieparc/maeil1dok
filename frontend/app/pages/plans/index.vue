<template>
  <PageLayout title="플랜 관리">
    <!-- 스크롤 영역 -->
    <div class="scroll-area">
      <div v-if="isLoading" class="flex flex-col gap-3 fade-in">
        <SkeletonPlanRow v-for="i in 4" :key="i" />
      </div>

      <div v-else-if="!auth.isAuthenticated.value" class="login-prompt fade-in">
        <p class="prompt-text">플랜을 구독하려면 로그인이 필요합니다.</p>
        <button class="login-button" @click="$router.push('/login')">
          로그인하기
        </button>
      </div>

      <div v-else class="content-section fade-in">
        <!-- 구독 중인 플랜 -->
        <section class="plan-section">
          <h2 class="section-title">
            <span>구독 중인 플랜</span>
            <span v-if="subscriptions.length" class="count-badge">
              {{ subscriptions.length }}개
            </span>
          </h2>

          <div v-if="!subscriptions.length" class="empty-state">
            <p>아직 구독 중인 플랜이 없습니다.</p>
          </div>

          <div v-else class="plan-grid">
            <div
              v-for="sub in subscriptions"
              :key="sub.id"
              class="plan-card"
              :class="{ 'hidden-plan': !sub.is_active }"
            >
              <div class="plan-card-content">
                <div class="plan-card-layout">
                  <div class="plan-info">
                    <h3 class="plan-title">
                      {{ sub.plan_name }}
                      <span v-if="sub.is_default" class="default-badge">기본 플랜</span>
                      <span v-if="!sub.is_active" class="hidden-badge">숨김</span>
                    </h3>
                    <p class="plan-meta">
                      구독 시작일: {{ formatDate(sub.start_date) }}
                    </p>
                  </div>
                  <div class="plan-actions">
                    <button
                      v-if="sub.is_active"
                      class="action-button today-reading"
                      @click="goToReadingPlan(sub)"
                    >
                      성경통독표
                    </button>
                    <button
                      v-if="!sub.is_default"
                      class="action-button"
                      :class="sub.is_active ? 'hide' : 'resume'"
                      @click="handleToggleHide(sub)"
                    >
                      {{ sub.is_active ? '숨기기' : '다시 보기' }}
                    </button>
                    <button
                      v-if="!sub.is_default && !sub.is_active"
                      class="action-button delete"
                      @click="confirmDelete(sub)"
                    >
                      완전 삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 구독 가능한 플랜 -->
        <section class="plan-section">
          <h2 class="section-title">
            <span>구독 가능한 플랜</span>
            <span v-if="availablePlans.length" class="count-badge">
              {{ availablePlans.length }}개
            </span>
          </h2>

          <div v-if="!availablePlans.length" class="empty-state">
            <p>현재 구독 가능한 플랜이 없습니다.</p>
          </div>

          <div v-else class="plan-grid">
            <div v-for="plan in availablePlans" :key="plan.id" class="plan-card">
              <div class="plan-card-content">
                <div class="plan-card-layout">
                  <div class="plan-info">
                    <h3 class="plan-title">
                      {{ plan.name }}
                      <span v-if="plan.is_default" class="default-badge">기본 플랜</span>
                    </h3>
                    <p class="plan-description">{{ plan.description }}</p>
                    <p class="subscriber-count">
                      구독한 사람: {{ plan.subscriber_count }}명
                    </p>
                  </div>
                  <button
                    class="action-button subscribe"
                    @click="handleSubscribe(plan)"
                  >
                    구독하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <Toast />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import { usePlanApi } from '~/composables/usePlanApi';
import { useToast } from '~/composables/useToast';
import { formatKoreanDate } from '~/utils/dateFormat';
import PageLayout from '~/components/common/PageLayout.vue';
import Toast from '~/components/Toast.vue';
import { useModal } from '~/composables/useModal';
import type { Plan, Subscription } from '~/types/plan';
import SkeletonPlanRow from '~/components/ui/skeleton/SkeletonPlanRow.vue';

const router = useRouter();
const auth = useAuthService();
const planApi = usePlanApi();

useHead({
  title: '내 통독 플랜 · 매일일독',
  meta: [
    { property: 'og:title', content: '내 통독 플랜 · 매일일독' },
    { property: 'og:description', content: '구독 중인 통독 플랜을 관리하고 진행 상황을 확인하세요.' },
    { name: 'description', content: '매일일독에서 통독 플랜을 구독하고 관리합니다.' },
  ],
});
const toast = useToast();

const subscriptions = ref<Subscription[]>([]);
const availablePlans = ref<Plan[]>([]);
const isLoading = ref(true);

const modal = useModal();

// 날짜 포맷팅
function formatDate(dateString: string): string {
  return formatKoreanDate(dateString);
}

// 사용자 플랜 정보 조회
async function fetchUserPlans() {
  if (!auth.isAuthenticated.value) return;

  const data = await planApi.fetchUserPlans();
  if (data) {
    subscriptions.value = data.subscriptions;
    availablePlans.value = data.available_plans;
  }
}

// 플랜 구독
async function handleSubscribe(plan: Plan) {
  const success = await planApi.subscribeToPlan(plan.id);
  if (success) {
    toast.success(`${plan.name} 플랜을 구독했습니다.`);
    await fetchUserPlans();
  }
}

// 숨기기/다시 보기 토글
async function handleToggleHide(subscription: Subscription) {
  const success = await planApi.togglePlanActive(subscription.id);
  if (success) {
    const message = subscription.is_active
      ? `${subscription.plan_name} 플랜을 숨겼습니다.`
      : `${subscription.plan_name} 플랜을 다시 표시합니다.`;
    toast.success(message);
    await fetchUserPlans();
  }
}

// 완전 삭제 (확인 모달 → 실행)
async function confirmDelete(subscription: Subscription) {
  const confirmed = await modal.confirm({
    title: '플랜을 완전히 삭제할까요?',
    description: '지금까지 진행된 읽기 기록이 전부 삭제되며, 복구할 수 없습니다.',
    confirmText: '완전 삭제',
    confirmVariant: 'danger',
    icon: 'warning',
  });
  if (!confirmed) return;

  const success = await planApi.deletePlanSubscription(subscription.id);
  if (success) {
    toast.success(`${subscription.plan_name} 플랜을 완전히 삭제했습니다.`);
    await fetchUserPlans();
  }
}

// 성경통독 일정 페이지로 이동
function goToReadingPlan(subscription: Subscription) {
  if (!subscription.is_active) {
    toast.error('비활성화된 플랜입니다. 먼저 플랜을 다시 구독해주세요.');
    return;
  }

  router.push({
    path: '/plan',
    query: { plan: String(subscription.plan_id) },
  });
}

// 컴포넌트 마운트 시 데이터 로드
onMounted(async () => {
  isLoading.value = true;

  try {
    if (auth.isAuthenticated.value) {
      await fetchUserPlans();
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.login-prompt {
  text-align: center;
  padding: 3rem 1rem;
}

.loading-text {
  font-size: 1rem;
  color: var(--color-slate-500);
}

.prompt-text {
  font-size: 1rem;
  color: var(--color-slate-600);
  margin-bottom: 1rem;
}

.login-button {
  background: var(--primary-color);
  color: var(--color-text-inverse);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
}

.login-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.plan-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count-badge {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: normal;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  background: var(--color-slate-100);
  border-radius: 0.5rem;
  color: var(--color-slate-500);
}

.plan-grid {
  display: grid;
  gap: 1rem;
}

.plan-card {
  min-height: 80px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-slate-200);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: var(--color-slate-300);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.plan-card-content {
  padding: 1rem;
}

.plan-card-layout {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.plan-info {
  flex: 1;
}

.plan-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.default-badge {
  font-size: 0.65rem;
  padding: 0.15em 0.75em;
  background: var(--color-slate-100);
  border-radius: 6px;
  font-weight: 600;
  color: var(--color-slate-500);
  border: 1px solid var(--color-slate-300);
}

.hidden-badge {
  font-size: 0.65rem;
  padding: 0.15em 0.75em;
  border-radius: 6px;
  font-weight: 600;
  background: var(--color-slate-400);
  color: var(--color-text-inverse);
}

.hidden-plan {
  opacity: 0.6;
  border-style: dashed;
  background: var(--color-slate-50);
}

.plan-meta {
  color: var(--text-secondary);
  margin-top: 0.25rem;
  font-size: 0.875rem;
}

.plan-description {
  color: var(--text-secondary);
  margin-top: 0.5rem;
  font-size: 0.875rem;
  word-break: break-word;
}

.subscriber-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.plan-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-button {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 80px;
  text-align: center;
}

.action-button.subscribe {
  background: var(--primary-color);
  color: var(--color-text-inverse);
}

.action-button.hide {
  background: var(--color-slate-100);
  border: 1px solid var(--color-slate-300);
  color: var(--color-slate-600);
}

.action-button.resume {
  background: var(--primary-color);
  color: var(--color-text-inverse);
}

.action-button.delete {
  background: var(--color-red-50);
  border: 1px solid var(--color-red-200);
  color: var(--color-red-600);
}

.action-button:hover {
  transform: translateY(-1px);
}

.action-button:active {
  transform: translateY(0);
}

.action-button.today-reading {
  background: var(--primary-light);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}
</style>
