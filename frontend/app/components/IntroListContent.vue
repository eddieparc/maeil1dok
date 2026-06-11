<template>
  <div class="bible-schedule-wrapper">
    <!-- 플랜 선택 컨트롤 (항상 표시) -->
    <div class="fixed-controls">
      <div class="top-row">
        <div class="plan-selector fade-in" style="animation-delay: 0.05s">
          <button class="plan-select-button" @click="showPlanModal = true">
            <span>{{ selectedPlanName }}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 비로그인 사용자 기본 플랜 안내 메시지 -->
      <Transition name="slide-fade">
        <div v-if="showDefaultPlanMessage && !auth.isAuthenticated.value"
          class="bulk-edit-indicator default-plan-indicator">
          <span class="bulk-edit-message">로그인하지 않으면 <strong>{{ defaultPlanName }}</strong>이 기본으로 선택돼요.</span>
        </div>
      </Transition>
    </div>

    <div class="schedule-body">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>목록을 불러오고 있어요</span>
      </div>
      <div v-else-if="error" class="no-schedules">
        <span>{{ error }}</span>
      </div>
      <div v-else-if="introductions.length === 0" class="no-schedules">
        <span>표시할 소개 영상이 없습니다.</span>
      </div>
      <div v-else class="schedule-list">
        <div
          v-for="intro in introductions"
          :key="intro.id"
          class="schedule-item"
          :class="getIntroStatusClass(intro)"
          @click="navigateToDetail(intro.id)"
        >
          <div class="checkbox">
            <input
              type="checkbox"
              :checked="intro.is_completed"
              @click.stop="toggleCompletion(intro)"
              :disabled="isToggling[intro.id]"
            />
          </div>
          <div class="schedule-info">
            <div class="schedule-date">
              <span v-if="isCurrentIntro(intro)" class="current-week-badge"
                >현재 주차</span
              >
              {{ formatDate(intro.start_date) }} ~
              {{ formatDate(intro.end_date) }}
            </div>
            <div class="schedule-reading">
              <span v-if="isCurrentIntro(intro)" class="current-location-badge"
                >현재 주차</span
              >
              <span class="bible-text">{{ intro.book }}</span>
            </div>
          </div>
          <div class="status-text">
            <svg
              v-if="intro.is_completed"
              class="status-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <svg
              v-else
              class="status-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            {{ getStatusText(intro) }}
          </div>
          <!-- Navigation indication icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="nav-icon"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <!-- 플랜 선택 모달 -->
    <PlanSelectorModal
      :show="showPlanModal"
      :subscriptions="subscriptions"
      :selected-plan-id="selectedPlanId"
      @close="showPlanModal = false"
      @select="selectPlan"
      @manage="goToPlanManagement"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import { useApi } from "~/composables/useApi";
import { useAuthService } from "~/composables/useAuthService";
import { useToast } from "~/composables/useToast";
import { usePlanApi } from "~/composables/usePlanApi";
import { useSelectedPlanStore } from "~/stores/selectedPlan";
import PlanSelectorModal from "~/components/schedule/PlanSelectorModal.vue";

// 애니메이션 딜레이 상수
const ANIMATION_DELAYS = {
  DEFAULT_PLAN_MESSAGE_SHOW: 500,
  DEFAULT_PLAN_MESSAGE_HIDE: 3000,
};

const introductions = ref([]);
const loading = ref(true);
const error = ref(null);
const router = useRouter();
const api = useApi();
const auth = useAuthService();
const planApi = usePlanApi();
const selectedPlanStore = useSelectedPlanStore();
const { success, error: showError } = useToast();

// 토글 진행 중인 항목 추적
const isToggling = reactive({});

// 플랜 선택 모달 상태
const showPlanModal = ref(false);

// 플랜 목록 (로그인/비로그인 모두 지원)
const subscriptions = ref([]);

// 비로그인 사용자 기본 플랜 안내 메시지 상태
const showDefaultPlanMessage = ref(false);
const defaultPlanName = ref('');

// 선택된 플랜 ID
const selectedPlanId = computed({
  get: () => selectedPlanStore.selectedPlanId,
  set: (val) => selectedPlanStore.setSelectedPlanId(val),
});

// 선택된 플랜 이름
const selectedPlanName = computed(() => {
  if (selectedPlanId.value) {
    const plan = subscriptions.value.find(
      (sub) => sub.plan_id === selectedPlanId.value
    );
    if (plan) return plan.plan_name;
  }
  if (subscriptions.value.length > 0) {
    return subscriptions.value[0].plan_name;
  }
  return "플랜 선택";
});

// 플랜 선택 핸들러
const selectPlan = (subscription) => {
  selectedPlanId.value = subscription.plan_id;
  showPlanModal.value = false;
  // 플랜 변경 시 개론 목록 다시 로드
  fetchIntroductions();
};

// 플랜 관리 페이지로 이동
const goToPlanManagement = () => {
  showPlanModal.value = false;
  router.push("/plans");
};

// 플랜 구독 목록 가져오기 (로그인/비로그인 모두 지원)
async function fetchSubscriptions() {
  const data = await planApi.fetchSubscriptions();
  subscriptions.value = data;
  handleSubscriptionSelection(data);
}

// 플랜 선택 처리 (비로그인 사용자 기본 플랜 설정 포함)
function handleSubscriptionSelection(subscriptionData) {
  // 1. Store에 저장된 플랜이 있으면 사용
  if (selectedPlanStore.selectedPlanId) {
    const planExists = subscriptionData.some(
      (sub) => sub.plan_id === selectedPlanStore.selectedPlanId
    );
    if (planExists) return;
  }

  // 2. 기본 플랜 설정
  if (subscriptionData.length > 0 && !selectedPlanId.value) {
    // 기본 플랜 찾기
    const defaultPlan = subscriptionData.find(sub => sub.is_default);
    selectedPlanId.value = defaultPlan ? defaultPlan.plan_id : subscriptionData[0].plan_id;

    // 비로그인 사용자에게 안내 메시지 표시
    if (!auth.isAuthenticated.value) {
      defaultPlanName.value = defaultPlan ? defaultPlan.plan_name : subscriptionData[0].plan_name;
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

const fetchIntroductions = async () => {
  loading.value = true;
  error.value = null;
  try {
    // 로그인 상태에 따라 다른 API 엔드포인트 호출
    let endpoint = auth.isAuthenticated.value
      ? "/api/v1/todos/user/video/intro/"
      : "/api/v1/todos/video/intro/";

    // plan_id 파라미터 추가 (선택된 플랜이 있는 경우)
    const planId = selectedPlanStore.effectivePlanId;
    if (planId) {
      endpoint += `?plan_id=${planId}`;
    }

    const response = await api.get(endpoint);
    if (response.data && response.data.results) {
      introductions.value = response.data.results;
    } else if (Array.isArray(response.data)) {
      introductions.value = response.data;
    } else {
      introductions.value = [];
      error.value = "데이터 형식이 올바르지 않습니다.";
    }
  } catch (err) {
    error.value = "목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    loading.value = false;
  }
};

const navigateToDetail = (introId) => {
  router.push(`/intro?id=${introId}`);
};

// 현재 날짜가 intro의 start_date와 end_date 사이에 있는지 확인
const isCurrentIntro = (intro) => {
  const today = new Date();
  const startDate = new Date(intro.start_date);
  const endDate = new Date(intro.end_date);

  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return today >= startDate && today <= endDate;
};

// 날짜 포맷팅 함수
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 개론 상태에 따른 클래스 반환
const getIntroStatusClass = (intro) => {
  if (intro.is_completed) return "completed";

  const today = new Date();
  const startDate = new Date(intro.start_date);
  const endDate = new Date(intro.end_date);

  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today >= startDate && today <= endDate) {
    return "current";
  } else if (endDate < today) {
    return "not_completed";
  } else {
    return "upcoming";
  }
};

// 상태 텍스트 반환
const getStatusText = (intro) => {
  if (intro.is_completed) return "완료";

  const today = new Date();
  const startDate = new Date(intro.start_date);
  const endDate = new Date(intro.end_date);

  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today >= startDate && today <= endDate) {
    return "현재 주차";
  } else if (endDate < today) {
    return "미완료";
  } else {
    return "예정";
  }
};

// 완료 상태 토글 함수
const toggleCompletion = async (intro) => {
  if (!auth.isAuthenticated.value) {
    // 로그인이 필요한 경우 로그인 페이지로 이동
    router.push(
      `/login?redirect=${encodeURIComponent(
        router.currentRoute.value.fullPath
      )}`
    );
    return;
  }

  // 이미 토글 중인 경우 처리 방지
  if (isToggling[intro.id]) {
    return;
  }

  // 토글 상태 시작
  isToggling[intro.id] = true;

  try {
    // 낙관적 업데이트 (UI 즉시 반영)
    const newCompletionStatus = !intro.is_completed;
    intro.is_completed = newCompletionStatus;

    // API 호출하여 서버에 상태 업데이트
    const response = await api.post("/api/v1/todos/video/intro/progress/", {
      video_intro_id: intro.id,
      is_completed: newCompletionStatus,
    });

    // 응답 데이터에서 완료 상태 가져오기 (서버 상태와 일치시키기)
    if (response.data && response.data.is_completed !== undefined) {
      intro.is_completed = response.data.is_completed;
    }

    // 성공 메시지 표시
    if (intro.is_completed) {
      success("완료 처리되었습니다.");
    } else {
      success("미완료 처리되었습니다.");
    }
  } catch (err) {
    // 에러 발생 시 상태 롤백
    intro.is_completed = !intro.is_completed;
    showError("상태 변경에 실패했습니다. 다시 시도해주세요.");
  } finally {
    // 토글 상태 완료
    isToggling[intro.id] = false;
  }
};

// 사용자 인증 상태 변경 감지
const initializeData = async () => {
  // localStorage에서 저장된 플랜 ID 복원
  selectedPlanStore.initializeFromStorage();
  
  // 플랜 목록 가져오기 (로그인/비로그인 모두)
  await fetchSubscriptions();
  
  // 플랜이 선택되어 있으면 개론 목록 가져오기
  if (selectedPlanId.value) {
    await fetchIntroductions();
  }
};

// 인증 상태 변경 감지
watch(
  () => auth.isAuthenticated.value,
  async () => {
    // 인증 상태가 변경되면 데이터 다시 가져오기
    await fetchSubscriptions();
    await fetchIntroductions();
  }
);

onMounted(() => {
  initializeData();
});
</script>
<style scoped src="./BibleScheduleContent.style.css"></style>
<style scoped>
/* 현재 주차 배지 스타일 */
.current-week-badge {
  display: none; /* schedule-reading 내의 current-location-badge만 표시 */
}

/* nav-icon 스타일 */
.nav-icon {
  color: var(--color-slate-400);
  flex-shrink: 0;
  margin-left: 0.5rem;
}
</style>
