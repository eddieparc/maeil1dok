<template>
  <div class="bible-schedule-wrapper">
    <!-- 고정 영역 -->
    <div class="fixed-controls">
      <!-- 상단 줄: 플랜 선택기 + 월 선택기 -->
      <div class="top-row">
        <!-- 플랜 선택기 버튼 -->
        <div class="plan-selector fade-in" style="animation-delay: 0.05s">
          <button class="plan-select-button" @click="showPlanModal = true">
            <span>{{ selectedPlanName }}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <!-- 월 선택기 -->
        <MonthSelector
          v-model="selectedMonth"
          class="fade-in"
          style="animation-delay: 0.1s"
        />
      </div>

      <!-- 하단 줄: 상태 표시기 -->
      <div class="status-indicators fade-in" style="animation-delay: 0.15s">
        <QuickNavigation
          :show-current-location="!!(props.currentBook && props.currentChapter)"
          @scroll-to="handleScrollTo"
        />
      </div>

      <!-- 일괄 수정 모드 인디케이터 -->
      <BulkEditIndicator
        :show="props.isBulkEditMode"
        :state="bulkEditState"
        @action="handleBulkAction"
      />

      <!-- 비로그인 사용자 기본 플랜 안내 메시지 -->
      <Transition name="slide-fade">
        <div v-if="showDefaultPlanMessage && !auth.isAuthenticated.value"
          class="bulk-edit-indicator default-plan-indicator">
          <span class="bulk-edit-message">비로그인 사용자는 <strong>{{ defaultPlanName }}</strong>이 기본 선택되요.</span>
        </div>
      </Transition>
    </div>

    <!-- 일정 목록 -->
    <div class="schedule-body fade-in" style="animation-delay: 0.2s" :data-is-modal="props.isModal" ref="scheduleBodyRef">
      <div v-if="isLoading || !isInitialized">
        <SkeletonList :count="7" variant="schedule" />
      </div>
      <div v-else-if="!selectedPlanId && !props.useDefaultPlan" class="no-plan-selected">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>플랜을 선택해주세요</span>
      </div>
      <div v-else-if="!filteredGroupedSchedules || Object.keys(filteredGroupedSchedules).length === 0"
        class="no-schedules">
        {{ selectedMonth }}월에 등록된 일정이 없습니다.
      </div>
      <div v-else class="schedule-list">
        <ScheduleItem
          v-for="(scheduleGroup, date) in filteredGroupedSchedules"
          :key="date"
          :date="String(date)"
          :schedules="scheduleGroup"
          :current-book="props.currentBook"
          :current-chapter="props.currentChapter"
          :is-modal="props.isModal"
          :is-bulk-edit-mode="props.isBulkEditMode"
          :is-in-selected-range="isInSelectedRange(scheduleGroup[0])"
          :is-mobile="isMobile"
          @group-click="handleScheduleClick"
          @group-checkbox="handleGroupCheckboxClick"
          @item-click="handleIndividualScheduleClick"
          @item-checkbox="handleCheckboxClick"
        />
      </div>
    </div>

    <!-- 본문 이동 모달 -->
    <ConfirmModal
      :show="showModal"
      title="본문 페이지로 이동하시겠어요?"
      confirm-text="이동"
      @confirm="confirmGoToSchedule"
      @cancel="closeModal"
    >
      <p class="reading-info">
        <span class="date">{{ selectedSchedule?.date ? formatScheduleDate(selectedSchedule.date) : '' }}</span>
        <span class="content">{{ selectedSchedule?.book }} {{
          selectedSchedule?.start_chapter === selectedSchedule?.end_chapter
            ? selectedSchedule?.start_chapter
            : `${selectedSchedule?.start_chapter}-${selectedSchedule?.end_chapter}`
        }}장</span>
      </p>
      <p class="guide-text">
        <span class="sub-text">읽음 표시는 왼쪽 체크박스를 누르거나,<br>오른쪽 위 일괄수정으로 바꿀 수 있어요.</span>
      </p>
    </ConfirmModal>

    <!-- 로그인 안내 모달 -->
    <ConfirmModal
      :show="showLoginModal"
      title="로그인이 필요해요"
      confirm-text="로그인"
      @confirm="goToLogin"
      @cancel="closeLoginModal"
    >
      <p class="reading-info">
        <span class="content">읽음 표시를 기록하시려면<br>로그인이 필요해요.</span>
      </p>
    </ConfirmModal>

    <!-- 플랜 선택 모달 -->
    <PlanSelectorModal
      :show="showPlanModal"
      :subscriptions="subscriptions"
      :selected-plan-id="selectedPlanId"
      @close="showPlanModal = false"
      @select="selectPlan"
      @manage="goToPlanManagement"
    />

    <!-- 최상단 이동 버튼 -->
    <Transition name="fade">
      <button v-show="showScrollTop" class="scroll-top-button" aria-label="최상단으로 이동" @click="scrollToTop">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 19V5M12 5l-7 7M12 5l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>
    </Transition>

    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import { useSelectedPlanStore } from '~/stores/selectedPlan';
import { usePlanApi } from '~/composables/usePlanApi';
import { useScheduleApi } from '~/composables/useScheduleApi';
import { useToast } from '~/composables/useToast';
import { useScrollToElement } from '~/composables/useScrollToElement';
import { getBookCode, getBookOrder, DAY_NAMES } from '~/constants/bible';
import { DEFAULT_BULK_EDIT_STATE, ANIMATION_DELAYS } from '~/types/plan';
import { getTodayString } from '~/utils/dateFormat';
import type {
  Schedule,
  SubscriptionSummary,
  BulkEditState,
  RangeSelectPayload,
  ReadingAction,
  GroupedSchedules,
  ScrollTarget,
} from '~/types/plan';

// Components
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import ConfirmModal from '~/components/ConfirmModal.vue';
import MonthSelector from '~/components/schedule/MonthSelector.vue';
import QuickNavigation from '~/components/schedule/QuickNavigation.vue';
import BulkEditIndicator from '~/components/schedule/BulkEditIndicator.vue';
import ScheduleItem from '~/components/schedule/ScheduleItem.vue';
import PlanSelectorModal from '~/components/schedule/PlanSelectorModal.vue';

// Props & Emits
const props = defineProps<{
  isModal?: boolean;
  currentBook?: string;
  currentChapter?: number;
  useDefaultPlan?: boolean;
  isBulkEditMode?: boolean;
  useNewBibleRoute?: boolean;
  initialScrollTarget?: 'today' | 'lastIncomplete' | 'currentLocation';
}>();

const emit = defineEmits<{
  'schedule-select': [schedule: Schedule];
  'range-select': [payload: RangeSelectPayload];
}>();

// Stores & Composables
const auth = useAuthService();
const planStore = useSelectedPlanStore();
const planApi = usePlanApi();
const scheduleApi = useScheduleApi();
const router = useRouter();
const route = useRoute();
const { success, error: showError, warning } = useToast();
const { scrollToElement, setScrollContainer } = useScrollToElement();

// UI State
const isLoading = ref(true);
const isInitialized = ref(false);
const showModal = ref(false);
const showLoginModal = ref(false);
const showPlanModal = ref(false);
const showScrollTop = ref(false);
const showDefaultPlanMessage = ref(false);
const isMobile = ref(false);
const initialScrollDone = ref(false);

// Data State
const selectedMonth = ref(new Date().getMonth() + 1);
const schedules = ref<Schedule[]>([]);
const subscriptions = ref<SubscriptionSummary[]>([]);
const selectedSchedule = ref<Schedule | null>(null);
const defaultPlanName = ref('');
const bulkEditState = ref<BulkEditState>({ ...DEFAULT_BULK_EDIT_STATE });

// Refs
const scheduleBodyRef = ref<HTMLElement | null>(null);

// 중복 호출 방지
const isInitializing = ref(false);

// Computed: 선택된 플랜 ID (Store 기반)
const selectedPlanId = computed({
  get: () => planStore.selectedPlanId,
  set: (val: number | null) => planStore.setSelectedPlanId(val),
});

// Computed: 선택된 플랜 이름
const selectedPlanName = computed(() => {
  if (selectedPlanId.value) {
    const plan = subscriptions.value.find(
      (sub) => sub.plan_id === selectedPlanId.value
    );
    if (plan) return plan.plan_name;
  }
  if (!props.useDefaultPlan) return '플랜 선택';
  if (subscriptions.value.length > 0) return subscriptions.value[0].plan_name;
  return '플랜 선택';
});

// Computed: 날짜별로 그룹화된 스케줄
const filteredGroupedSchedules = computed((): GroupedSchedules | null => {
  if (!isInitialized.value || !schedules.value) return null;

  const monthlySchedules = schedules.value.filter((schedule) => {
    const scheduleDate = new Date(schedule.date);
    return scheduleDate.getMonth() + 1 === selectedMonth.value;
  });

  return groupSchedulesByDate(monthlySchedules);
});

// ============================================
// Utility Functions
// ============================================

function groupSchedulesByDate(scheduleList: Schedule[]): GroupedSchedules {
  if (!scheduleList) return {};

  const grouped: GroupedSchedules = {};
  scheduleList.forEach((schedule) => {
    if (!grouped[schedule.date]) {
      grouped[schedule.date] = [];
    }
    grouped[schedule.date].push(schedule);
  });

  // 각 날짜의 스케줄을 성경책 순서대로 정렬
  Object.keys(grouped).forEach((date) => {
    grouped[date].sort((a, b) => getBookOrder(a.book) - getBookOrder(b.book));
  });

  return grouped;
}

function formatScheduleDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const dayName = DAY_NAMES[date.getDay()];

  if (isMobile.value) {
    return `${date.getMonth() + 1}/${date.getDate()}(${dayName})`;
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${dayName})`;
}

function isInSelectedRange(schedule: Schedule | null): boolean {
  if (!props.isBulkEditMode || !bulkEditState.value.firstSchedule || !schedule) {
    return false;
  }

  const firstDate = new Date(bulkEditState.value.firstSchedule.date);
  const currentDate = new Date(schedule.date);
  const secondDate = bulkEditState.value.secondSchedule
    ? new Date(bulkEditState.value.secondSchedule.date)
    : null;

  if (!secondDate) {
    return firstDate.getTime() === currentDate.getTime();
  }

  const startDate = firstDate < secondDate ? firstDate : secondDate;
  const endDate = firstDate < secondDate ? secondDate : firstDate;

  return currentDate >= startDate && currentDate <= endDate;
}

// ============================================
// API Functions
// ============================================

async function fetchSubscriptions() {
  const data = await planApi.fetchSubscriptions();
  subscriptions.value = data;
  handleSubscriptionSelection(data);
}

async function fetchSchedules() {
  if (!selectedPlanId.value) return;
  isLoading.value = true;

  const data = await scheduleApi.fetchMonthlySchedules(
    selectedPlanId.value,
    selectedMonth.value
  );
  schedules.value = data;
  isLoading.value = false;
}

// ============================================
// Event Handlers
// ============================================

async function handleGroupCheckboxClick(scheduleGroup: Schedule[]) {
  if (!auth.isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }

  const allCompleted = scheduleGroup.every((s) => s.is_completed);
  const isCompleted = !allCompleted;
  const action: ReadingAction = isCompleted ? 'complete' : 'cancel';
  const scheduleIds = scheduleGroup.map((s) => s.id);

  // 낙관적 업데이트
  scheduleGroup.forEach((s) => {
    s.is_completed = isCompleted;
  });

  const isSuccess = await scheduleApi.updateReadingStatus(
    selectedPlanId.value!,
    scheduleIds,
    action
  );

  if (isSuccess) {
    success(isCompleted ? '읽음 처리되었습니다.' : '읽지 않음으로 변경되었습니다.');
  } else {
    // 롤백
    scheduleGroup.forEach((s) => {
      s.is_completed = !isCompleted;
    });
  }
}

async function handleCheckboxClick(schedule: Schedule) {
  if (!auth.isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }

  const isCompleted = !schedule.is_completed;
  const action: ReadingAction = isCompleted ? 'complete' : 'cancel';

  // 낙관적 업데이트
  schedule.is_completed = isCompleted;

  const isSuccess = await scheduleApi.updateReadingStatus(
    selectedPlanId.value!,
    [schedule.id],
    action
  );

  if (isSuccess) {
    success(isCompleted ? '읽음 처리되었습니다.' : '읽지 않음으로 변경되었습니다.');
  } else {
    // 롤백
    schedule.is_completed = !isCompleted;
  }
}

function handleIndividualScheduleClick(schedule: Schedule) {
  if (props.isBulkEditMode) {
    handleScheduleClick([schedule]);
    return;
  }

  if (props.isModal) {
    emit('schedule-select', schedule);
  } else {
    selectedSchedule.value = schedule;
    showModal.value = true;
  }
}

function handleScheduleClick(scheduleGroup: Schedule[]) {
  if (!scheduleGroup?.length) return;

  if (props.isBulkEditMode) {
    if (!bulkEditState.value.firstSchedule) {
      bulkEditState.value.firstSchedule = scheduleGroup[0];
      bulkEditState.value.message = '마지막 일정을 선택해주세요';
      return;
    }

    if (!bulkEditState.value.secondSchedule) {
      bulkEditState.value.secondSchedule = scheduleGroup[0];
      bulkEditState.value.message = '선택한 일정을';
      bulkEditState.value.showActions = true;
      return;
    }
  } else if (scheduleGroup.length === 1) {
    if (props.isModal) {
      emit('schedule-select', scheduleGroup[0]);
    } else {
      selectedSchedule.value = scheduleGroup[0];
      showModal.value = true;
    }
  }
}

function handleBulkAction(action: ReadingAction) {
  if (!bulkEditState.value.firstSchedule || !bulkEditState.value.secondSchedule) {
    return;
  }

  const startDate = new Date(bulkEditState.value.firstSchedule.date);
  const endDate = new Date(bulkEditState.value.secondSchedule.date);
  const [fromDate, toDate] =
    startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

  const groupedSchedules = filteredGroupedSchedules.value;
  if (!groupedSchedules) return;

  const selectedSchedules: Schedule[] = [];
  Object.values(groupedSchedules).forEach((group) => {
    group.forEach((schedule) => {
      const scheduleDate = new Date(schedule.date);
      if (scheduleDate >= fromDate && scheduleDate <= toDate) {
        selectedSchedules.push(schedule);
      }
    });
  });

  const payload: RangeSelectPayload = {
    action,
    startSchedule: bulkEditState.value.firstSchedule,
    endSchedule: bulkEditState.value.secondSchedule,
    scheduleIds: selectedSchedules.map((s) => s.id),
    planId: selectedPlanId.value,
  };

  emit('range-select', payload);

  // 낙관적 업데이트
  selectedSchedules.forEach((s) => {
    s.is_completed = action === 'complete';
  });

  // 상태 초기화
  bulkEditState.value = { ...DEFAULT_BULK_EDIT_STATE };
}

async function selectPlan(subscription: SubscriptionSummary) {
  const newPlanId = Number(subscription.plan_id);
  const currentPlanId = selectedPlanId.value;

  // 같은 플랜 선택 시 무시
  if (currentPlanId === newPlanId) {
    showPlanModal.value = false;
    return;
  }

  selectedPlanId.value = newPlanId;
  showPlanModal.value = false;

  // 플랜 변경 시 스케줄 다시 로드
  await fetchSchedules();
}

// ============================================
// Scroll Functions
// ============================================

async function handleScrollTo(target: ScrollTarget) {
  switch (target) {
    case 'today':
      await scrollToToday();
      break;
    case 'lastIncomplete':
      await scrollToLastIncomplete();
      break;
    case 'currentLocation':
      await scrollToCurrentLocation();
      break;
  }
}

async function scrollToToday() {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayString = getTodayString();

  if (selectedMonth.value !== todayMonth) {
    selectedMonth.value = todayMonth;
    await fetchSchedules();
  }

  await nextTick();
  const todayElement = document.querySelector(`[data-date="${todayString}"]`);
  scrollToElement(todayElement as HTMLElement);
}

async function scrollToLastIncomplete() {
  if (!selectedPlanId.value) return;

  const data = await scheduleApi.fetchNextPosition(selectedPlanId.value);

  if (!data) {
    // API 호출 실패 (네트워크 에러 등) - 조용히 실패
    return;
  }

  if (data.success && data.date && data.month) {
    if (selectedMonth.value !== data.month) {
      selectedMonth.value = data.month;
      await fetchSchedules();
      await nextTick();
    }

    const element = document.querySelector(`[data-date="${data.date}"]`);
    scrollToElement(element as HTMLElement);

    // 모든 일정 완료 시 축하 메시지
    if (data.status === 'all_completed' && data.message) {
      success(data.message);
    }
  }
  // success가 false인 경우 (no_schedule 등)는 조용히 처리
  // 불필요한 경고 메시지 제거
}

async function scrollToCurrentLocation() {
  if (!props.currentBook || !props.currentChapter || !selectedPlanId.value) return;

  const data = await scheduleApi.fetchCurrentPosition(
    selectedPlanId.value,
    props.currentBook,
    props.currentChapter
  );

  if (data?.plan_date) {
    const targetMonth = new Date(data.plan_date).getMonth() + 1;
    if (selectedMonth.value !== targetMonth) {
      selectedMonth.value = targetMonth;
      await fetchSchedules();
      await nextTick();
    }

    const targetElement = document.querySelector(`[data-date="${data.plan_date}"]`);
    scrollToElement(targetElement as HTMLElement);
  }
}

function scrollToTop() {
  const firstItem = document.querySelector('.schedule-item');
  scrollToElement(firstItem as HTMLElement, { behavior: 'smooth' });
}

// 초기 스크롤 수행 함수
async function performInitialScroll() {
  if (initialScrollDone.value) return;
  if (!isInitialized.value || !scheduleBodyRef.value) return;

  initialScrollDone.value = true;
  await nextTick();

  if (props.initialScrollTarget) {
    await handleScrollTo(props.initialScrollTarget);
  } else if (props.isModal && props.currentBook && props.currentChapter) {
    await scrollToCurrentLocation();
  } else {
    await scrollToLastIncomplete();
  }
}

// ============================================
// Navigation Functions
// ============================================

function confirmGoToSchedule() {
  if (!selectedSchedule.value) return;

  const queryParams = new URLSearchParams();

  // 기존 쿼리 파라미터 유지
  Object.entries(route.query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== null) queryParams.append(key, String(v));
      });
    }
  });

  if (selectedPlanId.value) {
    queryParams.set('plan', String(selectedPlanId.value));
  }
  queryParams.set('tongdok', 'true');
  queryParams.set('schedule', String(selectedSchedule.value.id));
  queryParams.set('from', 'plan');

  if (selectedSchedule.value.book) {
    const bookCode = getBookCode(selectedSchedule.value.book);
    if (bookCode) {
      queryParams.set('book', bookCode);
      queryParams.set('chapter', String(selectedSchedule.value.start_chapter));
    }
  }

  router.push({
    path: '/bible',
    query: Object.fromEntries(queryParams),
  });

  showModal.value = false;
}

function goToLogin() {
  const currentQuery = { ...route.query };
  const queryParams = new URLSearchParams();

  Object.entries(currentQuery).forEach(([key, value]) => {
    if (typeof value === 'string') {
      queryParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => queryParams.append(key, v));
    }
  });

  const queryString = queryParams.toString();
  const currentPath = `${route.path}${queryString ? '?' + queryString : ''}`;

  router.push({
    path: '/login',
    query: { redirect: currentPath },
  });

  showLoginModal.value = false;
}

function goToPlanManagement() {
  showPlanModal.value = false;
  router.push('/plans');
}

function closeModal() {
  showModal.value = false;
  document.body.style.overflow = '';
}

function closeLoginModal() {
  showLoginModal.value = false;
  document.body.style.overflow = '';
}

// ============================================
// Initialization
// ============================================

function handleSubscriptionSelection(subscriptionData: SubscriptionSummary[]) {
  // 1. URL에 plan 파라미터가 있으면 우선 적용
  if (route.query.plan) {
    const planId = Number(route.query.plan);
    const planExists = subscriptionData.some((sub) => sub.plan_id === planId);
    if (planExists) {
      selectedPlanId.value = planId;
      return;
    }
  }

  // 2. Store에 저장된 플랜이 있으면 사용
  if (planStore.selectedPlanId) {
    const planExists = subscriptionData.some(
      (sub) => sub.plan_id === planStore.selectedPlanId
    );
    if (planExists) return;
  }

  // 3. 기본 플랜 설정
  if (subscriptionData.length > 0 && !selectedPlanId.value) {
    if (props.useDefaultPlan || !auth.isAuthenticated.value) {
      selectedPlanId.value = subscriptionData[0].plan_id;

      if (!auth.isAuthenticated.value) {
        defaultPlanName.value = subscriptionData[0].plan_name;
        showDefaultPlanMessage.value = false;

        setTimeout(() => {
          showDefaultPlanMessage.value = true;
          setTimeout(() => {
            showDefaultPlanMessage.value = false;
          }, ANIMATION_DELAYS.DEFAULT_PLAN_MESSAGE_HIDE);
        }, ANIMATION_DELAYS.DEFAULT_PLAN_MESSAGE_SHOW);
      }
    }
  }
}

async function initializeComponent() {
  if (isInitializing.value) return;
  isInitializing.value = true;

  try {
    await fetchSubscriptions();
    if (selectedPlanId.value) {
      await fetchSchedules();
    }
    isInitialized.value = true;
  } finally {
    isLoading.value = false;
    isInitializing.value = false;
  }
}

function updateIsMobile() {
  isMobile.value = window.innerWidth <= 640;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (showModal.value) closeModal();
    else if (showLoginModal.value) closeLoginModal();
    else if (showPlanModal.value) showPlanModal.value = false;
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  showScrollTop.value = target.scrollTop > 200;
}

// ============================================
// Lifecycle Hooks
// ============================================

onMounted(() => {
  planStore.initializeFromStorage();

  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);

  document.addEventListener('keydown', handleKeydown);

  initializeComponent();
});

onBeforeUnmount(() => {
  if (scheduleBodyRef.value) {
    scheduleBodyRef.value.removeEventListener('scroll', handleScroll);
  }
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', updateIsMobile);
});

// ============================================
// Watchers
// ============================================

// scheduleBodyRef가 설정되면 스크롤 컨테이너 설정
watch(scheduleBodyRef, (newRef, oldRef) => {
  if (oldRef) {
    oldRef.removeEventListener('scroll', handleScroll);
  }
  if (newRef) {
    setScrollContainer(newRef);
    newRef.addEventListener('scroll', handleScroll);
  }
}, { immediate: true });

// isInitialized와 scheduleBodyRef 모두 준비되면 초기 스크롤 수행
watch([() => isInitialized.value, scheduleBodyRef], ([initialized, ref]) => {
  if (initialized && ref && !initialScrollDone.value) {
    setTimeout(performInitialScroll, ANIMATION_DELAYS.SCROLL_TO_CURRENT);
  }
});

watch(() => props.isModal, async (newVal) => {
  if (newVal) {
    isInitialized.value = false;
    isLoading.value = true;
    initialScrollDone.value = false; // 모달 열릴 때 스크롤 상태 리셋

    await initializeComponent();
    // 초기 스크롤은 watch([isInitialized, scheduleBodyRef])에서 처리됨
  }
}, { immediate: true });

watch(
  [selectedMonth, selectedPlanId],
  async ([newMonth, newPlanId], [oldMonth, oldPlanId]) => {
    if (newMonth === oldMonth && newPlanId === oldPlanId) return;
    if (isInitialized.value && !isInitializing.value) {
      await fetchSchedules();
    }
  }
);

watch(() => props.isBulkEditMode, (newValue) => {
  if (!newValue) {
    bulkEditState.value = { ...DEFAULT_BULK_EDIT_STATE };
  }
});

watch([showModal, showLoginModal, showPlanModal], ([modal, loginModal, planModal]) => {
  document.body.style.overflow = modal || loginModal || planModal ? 'hidden' : '';
});
</script>

<style scoped src="./BibleScheduleContent.style.css"></style>
