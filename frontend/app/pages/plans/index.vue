<template>
  <PageLayout title="플랜 관리" fallback-path="/plan">
    <div class="plans-content">
      <div v-if="!started || auth.isLoading.value" class="plans-loading" data-state="loading" role="status" aria-label="플랜을 불러오는 중">
        <SkeletonPlanRow v-for="i in 4" :key="i" class="plan-skeleton" />
      </div>
      <div v-else-if="auth.isSessionUnknown.value" class="state-card" data-state="session-unknown" role="status">
        <WifiOff :size="32" aria-hidden="true" />
        <p>로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.</p>
        <AppButton variant="secondary" data-action="retry-auth" :loading="authRetrying" @click="retryAuth">다시 시도</AppButton>
      </div>
      <div v-else-if="!auth.isAuthenticated.value" class="state-card" data-state="guest">
        <span class="guest-icon"><BookOpen :size="28" aria-hidden="true" /></span>
        <p>플랜을 구독하려면 로그인이 필요해요.</p>
        <AppButton to="/login" data-action="login">로그인하기</AppButton>
      </div>
      <template v-else>
        <div v-if="isLoading && !hasLoaded" class="plans-loading" data-state="loading" role="status" aria-label="플랜을 불러오는 중">
          <SkeletonPlanRow v-for="i in 4" :key="i" class="plan-skeleton" />
        </div>
        <div v-if="listError" class="state-card list-error" data-state="plans-error" role="alert">
          <p>플랜 정보를 불러오지 못했어요. 다시 불러온 뒤 플랜을 관리할 수 있어요.</p>
          <AppButton variant="secondary" data-action="retry-plans" :loading="isLoading" @click="loadPlans">다시 시도</AppButton>
        </div>
        <div v-if="hasLoaded" class="content-section" :aria-busy="isLoading">
          <section class="plan-section" data-section="subscriptions" aria-labelledby="subscriptions-title">
            <h2 id="subscriptions-title" class="section-title">구독 중인 플랜 <span class="count-badge">{{ subscriptions.length }}</span></h2>
            <div v-if="!subscriptions.length" class="empty-state" data-empty="subscriptions">아직 구독 중인 플랜이 없어요.</div>
            <div v-else class="plan-grid">
              <article v-for="sub in subscriptionCards" :key="sub.id" class="plan-card" :class="{ 'hidden-plan': !sub.is_active }" :data-subscription="sub.id">
                <div class="plan-card-heading">
                  <div class="plan-info">
                    <h3 class="plan-title">{{ sub.plan_name }} <span v-if="sub.is_default" class="default-badge">기본 플랜</span><span v-if="!sub.is_active" class="hidden-badge">숨김</span></h3>
                    <p class="plan-meta">{{ formatKoreanDate(sub.start_date) }}부터<span v-if="sub.summary?.data" class="completion-count"> · {{ sub.summary.data.completed_days }}/{{ sub.summary.data.total_days }}일 완료</span></p>
                  </div>
                  <div v-if="sub.is_active && sub.summary?.data" class="progress-ring" role="progressbar" :aria-label="`${sub.plan_name} 읽기 진도`" :aria-valuenow="sub.summary.data.percent" :aria-valuemin="0" :aria-valuemax="100" :style="{ '--progress': `${sub.summary.data.percent}%` }">
                    <span>{{ Math.round(sub.summary.data.percent) }}<small>%</small></span>
                  </div>
                </div>
                <div v-if="sub.summary?.loading && !sub.summary.data" class="summary-loading" role="status" aria-label="진도를 불러오는 중"><Skeleton width="100%" height="3px" /></div>
                <div v-if="sub.summary?.error" class="summary-error" role="status">
                  <span>진도를 불러오지 못했어요.</span>
                  <AppButton variant="ghost" size="sm" data-action="retry-summary" :loading="sub.summary.loading" @click="loadSummary(sub.id)"><RotateCcw :size="14" aria-hidden="true" />다시 시도</AppButton>
                </div>
                <progress v-if="sub.summary?.data" class="progress-bar" :value="sub.summary.data.percent" max="100" :aria-label="`${sub.plan_name} 읽기 진도`" />
                <div class="plan-actions">
                  <AppButton v-if="sub.is_active" variant="secondary" size="sm" class="schedule-action" data-action="schedule" :disabled="actionsDisabled" @click="goToReadingPlan(sub)"><CalendarDays :size="15" aria-hidden="true" />성경통독표</AppButton>
                  <AppButton v-if="!sub.is_default" variant="secondary" size="sm" class="outline-action" data-action="toggle" :disabled="actionsDisabled" :loading="busyAction === `toggle:${sub.id}`" @click="handleToggleHide(sub)"><component :is="sub.is_active ? EyeOff : Eye" :size="15" aria-hidden="true" />{{ sub.is_active ? '숨기기' : '다시 보기' }}</AppButton>
                  <AppButton v-if="!sub.is_default && !sub.is_active" variant="danger" size="sm" class="delete-action" data-action="delete" :disabled="actionsDisabled" :loading="busyAction === `delete:${sub.id}`" @click="confirmDelete(sub, $event)">완전 삭제</AppButton>
                </div>
              </article>
            </div>
          </section>
          <section class="plan-section" data-section="available" aria-labelledby="available-title">
            <h2 id="available-title" class="section-title">구독 가능한 플랜 <span class="count-badge">{{ availablePlans.length }}</span></h2>
            <div v-if="!availablePlans.length" class="empty-state" data-empty="available">현재 구독 가능한 플랜이 없어요.</div>
            <div v-else class="plan-grid">
              <article v-for="plan in availablePlans" :key="plan.id" class="plan-card" :data-plan="plan.id">
                <h3 class="plan-title">{{ plan.name }} <span v-if="plan.is_default" class="default-badge">기본 플랜</span></h3>
                <p v-if="plan.description" class="plan-description">{{ plan.description }}</p>
                <div class="available-actions">
                  <p class="subscriber-count"><Users :size="14" aria-hidden="true" />{{ plan.subscriber_count }}명 구독 중</p>
                  <AppButton variant="secondary" size="sm" class="subscribe-action" data-action="subscribe" :disabled="actionsDisabled" :loading="busyAction === `subscribe:${plan.id}`" @click="handleSubscribe(plan)">구독하기</AppButton>
                </div>
              </article>
            </div>
          </section>
        </div>
      </template>
    </div>
    <Toast />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { BookOpen, CalendarDays, Eye, EyeOff, RotateCcw, Users, WifiOff } from '@lucide/vue';
import { useAuthService } from '~/composables/useAuthService';
import { usePlanApi } from '~/composables/usePlanApi';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { formatKoreanDate } from '~/utils/dateFormat';
import PageLayout from '~/components/common/PageLayout.vue';
import AppButton from '~/components/ui/AppButton.vue';
import Skeleton from '~/components/ui/Skeleton.vue';
import SkeletonPlanRow from '~/components/ui/skeleton/SkeletonPlanRow.vue';
import Toast from '~/components/Toast.vue';
import type { Plan, Subscription } from '~/types/plan';

const router = useRouter();
const auth = useAuthService();
const planApi = usePlanApi();
const toast = useToast();
const modal = useModal();
useHead({
  title: '내 통독 플랜 · 매일일독',
  meta: [
    { property: 'og:title', content: '내 통독 플랜 · 매일일독' },
    { property: 'og:description', content: '구독 중인 통독 플랜을 관리하고 진행 상황을 확인하세요.' },
    { name: 'description', content: '매일일독에서 통독 플랜을 구독하고 관리합니다.' },
  ],
});

type SummaryState = {
  data: Awaited<ReturnType<typeof planApi.fetchPlanSummary>>;
  loading: boolean;
  error: boolean;
};
const subscriptions = ref<Subscription[]>([]);
const availablePlans = ref<Plan[]>([]);
const summaries = ref<Partial<Record<number, SummaryState>>>({});
const subscriptionCards = computed(() => subscriptions.value.map(sub => ({ ...sub, summary: summaries.value[sub.id] })));
const started = ref(false);
const isLoading = ref(false);
const hasLoaded = ref(false);
const listError = ref(false);
const authRetrying = ref(false);
const busyAction = ref<string | null>(null);
const actionsDisabled = computed(() => !auth.isAuthenticated.value || isLoading.value || listError.value || busyAction.value !== null);
let epoch = 0;
let listQueue = Promise.resolve();

async function loadSummary(subscriptionId: number) {
  const state = summaries.value[subscriptionId];
  if (!auth.isAuthenticated.value || !state || state.loading) return;
  const requestEpoch = epoch;
  state.loading = true;
  state.error = false;
  const data = await planApi.fetchPlanSummary(subscriptionId);
  if (requestEpoch !== epoch || summaries.value[subscriptionId] !== state) return;
  state.loading = false;
  state.error = data === null;
  if (data) state.data = data;
}

function loadPlans(): Promise<void> {
  if (!auth.isAuthenticated.value || isLoading.value) return listQueue;
  const requestEpoch = epoch;
  isLoading.value = true;
  listError.value = false;
  // Serialize account changes too: the facade intentionally rejects duplicate
  // list reads. An obsolete response must never become the next owner's data.
  listQueue = listQueue.then(async () => {
    if (requestEpoch !== epoch) return;
    const data = await planApi.fetchUserPlans();
    if (requestEpoch !== epoch) return;
    isLoading.value = false;
    if (!data) { listError.value = true; return; }
    subscriptions.value = data.subscriptions;
    availablePlans.value = data.available_plans;
    hasLoaded.value = true;
    summaries.value = Object.fromEntries(data.subscriptions.map(sub => [sub.id, {
      data: summaries.value[sub.id]?.data ?? null, loading: false, error: false,
    }]));
    for (const sub of data.subscriptions) void loadSummary(sub.id);
  });
  return listQueue;
}

async function retryAuth() {
  if (authRetrying.value) return;
  authRetrying.value = true;
  try { await auth.revalidate(); }
  finally { authRetrying.value = false; }
}

async function runAction(key: string, write: () => Promise<boolean>, message: string, confirm?: () => Promise<boolean>) {
  if (actionsDisabled.value) return;
  const actionEpoch = epoch;
  busyAction.value = key;
  try {
    if (confirm && !await confirm()) return;
    if (actionEpoch !== epoch || !auth.isAuthenticated.value) return;
    const success = await write();
    if (!success || actionEpoch !== epoch) return;
    toast.success(message);
    // Do not invent a subscription ID or optimistically discard reading data.
    // A failed reconciliation keeps the cards but blocks writes until retry.
    await loadPlans();
  } finally { busyAction.value = null; }
}

function handleSubscribe(plan: Plan) {
  if (!availablePlans.value.some(item => item.id === plan.id)) return;
  return runAction(`subscribe:${plan.id}`, () => planApi.subscribeToPlan(plan.id), `${plan.name} 플랜을 구독했어요`);
}
function handleToggleHide(subscription: Subscription) {
  const current = subscriptions.value.find(sub => sub.id === subscription.id);
  if (!current || current.is_default) return;
  return runAction(`toggle:${current.id}`, () => planApi.togglePlanActive(current.id), `${current.plan_name} 플랜을 ${current.is_active ? '숨겼어요' : '다시 표시해요'}`);
}
function confirmDelete(subscription: Subscription, event: MouseEvent) {
  const current = subscriptions.value.find(sub => sub.id === subscription.id);
  if (!current || current.is_default || current.is_active) return;
  // The write lock disables/blurs this button before the modal captures focus.
  const trigger = event.currentTarget as HTMLButtonElement;
  const actionEpoch = epoch;
  return runAction(`delete:${current.id}`, () => planApi.deletePlanSubscription(current.id), `${current.plan_name} 플랜을 완전히 삭제했어요`, () => modal.confirm({
    title: '플랜을 완전히 삭제할까요?',
    description: `${current.plan_name}의 읽기 기록이 모두 삭제되며 복구할 수 없어요.`,
    confirmText: '완전 삭제',
    confirmVariant: 'danger',
    icon: 'warning',
  })).finally(async () => {
    // runAction has released its lock; wait until AppButton is enabled in DOM.
    await nextTick();
    if (actionEpoch === epoch && !actionsDisabled.value && !modal.isOpen.value && trigger.isConnected) {
      trigger.focus();
    }
  });
}
function goToReadingPlan(subscription: Subscription) {
  if (actionsDisabled.value || !subscriptions.value.some(sub => sub.id === subscription.id && sub.is_active)) return;
  router.push({ path: '/plan', query: { plan: String(subscription.plan_id) } });
}

watch(() => [started.value, auth.authState.value, auth.user.value?.id] as const, ([ready, state, userId], previous) => {
  epoch++;
  isLoading.value = false;
  listError.value = false;
  for (const summary of Object.values(summaries.value)) {
    if (summary?.loading) { summary.loading = false; summary.error = true; }
  }
  if (userId !== previous?.[2] || state === 'unauthenticated') {
    subscriptions.value = [];
    availablePlans.value = [];
    summaries.value = {};
    hasLoaded.value = false;
  }
  if (ready && state === 'authenticated') void loadPlans();
}, { flush: 'sync' });
onMounted(async () => { await auth.initialize(); started.value = true; });
onBeforeUnmount(() => { epoch++; });
</script>

<style scoped>
.plans-content { padding: var(--screen-gutter); color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.content-section { display: flex; flex-direction: column; gap: 22px; }
.plans-loading, .plan-grid { display: grid; gap: 14px; }
.plan-skeleton { min-height: 96px; }
.section-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; color: var(--color-text-secondary); font-size: 13px; font-weight: 600; }
.count-badge { display: inline-grid; place-items: center; min-width: 20px; min-height: 20px; padding: 0 6px; background: var(--color-bg-tertiary); border-radius: var(--radius-pill); font-size: 11px; font-variant-numeric: tabular-nums; }
.plan-card { min-width: 0; padding: var(--card-padding); border: 1px solid var(--color-border-default); border-radius: 20px; background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.plan-card-heading { display: flex; align-items: center; gap: 12px; }
.plan-info { flex: 1; min-width: 0; }
.plan-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.default-badge, .hidden-badge { padding: 4px 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; line-height: 1.2; }
.default-badge { background: var(--color-accent-bg); color: var(--color-accent-primary); }
.hidden-badge { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.hidden-plan { opacity: .72; }
.plan-meta { margin: 8px 0 0; color: var(--color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.progress-ring { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; background: conic-gradient(var(--color-accent-primary) var(--progress), var(--color-border-default) 0); }
.progress-ring > span { display: flex; align-items: baseline; justify-content: center; width: 34px; height: 34px; line-height: 34px; border-radius: 50%; background: var(--color-bg-card); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.6px; }
.progress-ring small { font-size: 8px; }
.progress-bar { display: block; appearance: none; width: 100%; height: 3px; margin-top: 14px; border: 0; border-radius: 2px; overflow: hidden; background: var(--color-border-default); color: var(--color-accent-primary); }
.progress-bar::-webkit-progress-bar { background: var(--color-border-default); }
.progress-bar::-webkit-progress-value { background: var(--color-accent-primary); }
.progress-bar::-moz-progress-bar { background: var(--color-accent-primary); }
.summary-loading { margin-top: 14px; }
.summary-error { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 8px; color: var(--color-error); font-size: 12px; }
.plan-actions, .available-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.schedule-action { border-color: var(--color-accent-primary); }
.outline-action { background: transparent; color: var(--color-text-secondary); }
.delete-action { margin-left: auto; }
.plan-description { margin: 8px 0 0; color: var(--color-text-secondary); font-size: 13px; overflow-wrap: anywhere; }
.available-actions { justify-content: space-between; }
.subscriber-count { display: flex; align-items: center; gap: 4px; margin: 0; color: var(--color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.subscribe-action { background: transparent; border-color: var(--color-accent-primary); }
.empty-state { padding: 28px 20px; border: 1px dashed var(--color-border-default); border-radius: 20px; color: var(--color-text-secondary); text-align: center; font-size: 13px; }
.state-card { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 20px; border: 1px solid var(--color-border-default); border-radius: 20px; background: var(--color-bg-card); text-align: center; color: var(--color-text-secondary); }
.state-card p { margin: 0; font-size: 14px; }
.guest-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--color-accent-bg); color: var(--color-accent-primary); }
.list-error { margin-bottom: 20px; }
@media (max-width: 360px) { .plan-actions { gap: 4px; } .plan-actions .app-button { padding-inline: 12px; } }
</style>
