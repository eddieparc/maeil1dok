<template>
  <PageLayout :title="currentGroup?.name || '그룹 정보'">
    <div class="content-wrapper">
      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="flex flex-col gap-4">
        <SkeletonProfileHeader />
        <SkeletonStats :count="3" />
        <SkeletonCalendar />
      </div>

      <!-- 에러 상태 -->
      <div v-else-if="error" class="error-state">
        <Card>
          <div class="error-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3>그룹을 불러올 수 없습니다</h3>
            <p>{{ error }}</p>
            <button @click="navigateTo('/groups')" class="btn-primary">
              그룹 목록으로 돌아가기
            </button>
          </div>
        </Card>
      </div>

      <!-- 그룹 정보 -->
      <template v-else-if="currentGroup">
        <!-- 그룹 기본 정보 (항상 표시) -->
        <div class="group-info-card fade-in">
          <div class="group-header">
            <div class="header-top">
              <span
                :class="[
                  'status-badge',
                  currentGroup.is_public ? 'status-public' : 'status-private'
                ]"
              >
                {{ currentGroup.is_public ? '공개' : '비공개' }}
              </span>
              <span class="member-count">
                {{ currentGroup.member_count }}/{{ currentGroup.max_members }}명
              </span>
            </div>
            <h2 class="group-name">{{ currentGroup.name }}</h2>
          </div>

          <p class="group-description">
            {{ currentGroup.description || '설명이 없습니다.' }}
          </p>

          <div class="group-meta">
            <div class="meta-row">
              <span class="meta-label">리더</span>
              <span class="meta-value">{{ currentGroup.creator?.nickname || '알 수 없음' }}</span>
            </div>
            <div class="meta-row" v-if="currentGroup.plans && currentGroup.plans.length > 0">
              <span class="meta-label">읽기표</span>
              <div class="plans-wrapper">
                <span class="plan-text" v-if="currentGroup.plans.length === 1">{{ currentGroup.plans[0].name }}</span>
                <span class="plan-text" v-else>
                  {{ currentGroup.plans[0].name }} 외 {{ currentGroup.plans.length - 1 }}개
                </span>
              </div>
            </div>
          </div>

          <!-- 액션 버튼 -->
          <div v-if="isAuthenticated" class="action-buttons">
            <button
              v-if="!currentGroup.is_member && !currentGroup.is_full"
              @click="handleJoinGroup"
              :disabled="isActionLoading"
              class="btn-action btn-primary"
            >
              {{ isActionLoading ? '처리 중...' : '그룹 가입하기' }}
            </button>

            <button
              v-else-if="currentGroup.is_member && currentGroup.my_role !== '관리자'"
              @click="handleLeaveGroup"
              :disabled="isActionLoading"
              class="btn-action btn-danger"
            >
              {{ isActionLoading ? '처리 중...' : '그룹 탈퇴하기' }}
            </button>

            <div v-else-if="currentGroup.is_member && currentGroup.my_role === '관리자'" class="status-box admin-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>관리자입니다</span>
            </div>

            <div v-else-if="currentGroup.is_full" class="status-box full-box">
              정원 초과
            </div>
          </div>
        </div>

        <!-- 탭 네비게이션 -->
        <div class="tab-navigation fade-in delay-100">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="activeTab = tab.value"
            :class="['tab-button', { active: activeTab === tab.value }]"
          >
            <component :is="tab.icon" class="tab-icon" />
            {{ tab.label }}
          </button>
        </div>

        <!-- 탭 콘텐츠: 정보 -->
        <template v-if="activeTab === 'info'">
          <!-- 플랜 선택 및 일정 캘린더 -->
          <div v-if="currentGroup.plans && currentGroup.plans.length > 0" class="section-card fade-in">
            <div class="section-header">
              <h3 class="section-title">읽기 계획 일정</h3>
            </div>

            <!-- 플랜 선택 탭 -->
            <div v-if="currentGroup.plans.length > 1" class="plan-tabs">
              <button
                v-for="plan in currentGroup.plans"
                :key="plan.id"
                @click="selectedPlanId = plan.id"
                :class="['plan-tab', { 'active': selectedPlanId === plan.id }]"
              >
                {{ plan.name }}
              </button>
            </div>

            <!-- 단일 플랜일 경우 이름만 표시 -->
            <div v-else class="single-plan-name">
              {{ currentGroup.plans[0].name }}
            </div>

            <!-- 캘린더 -->
            <GroupPlanCalendar
              v-if="selectedPlanId"
              :plan-id="selectedPlanId"
              class="mt-4"
            />
          </div>

          <!-- 멤버 목록 -->
          <div class="section-card fade-in">
            <div class="section-header">
              <h3 class="section-title">멤버 목록</h3>
              <span class="member-count-badge">{{ currentGroupMembers.length }}명</span>
            </div>

            <SkeletonList v-if="isMembersLoading" :count="5" variant="user" />

            <div v-else-if="currentGroupMembers.length > 0" class="members-list">
              <div
                v-for="member in currentGroupMembers"
                :key="member.user.id"
                class="member-item"
              >
                <div class="member-info">
                  <div class="member-avatar">
                    <NuxtImg
                      v-if="member.user.profile_image"
                      :src="member.user.profile_image"
                      :alt="member.user.nickname"
                      class="avatar-image"
                      loading="lazy"
                    />
                    <div v-else class="avatar-placeholder">
                      {{ member.user.nickname?.charAt(0) || '?' }}
                    </div>
                  </div>

                  <div class="member-details">
                    <div class="member-name">{{ member.user.nickname }}</div>
                    <div class="member-joined">
                      {{ formatDate(member.joined_at) }} 가입
                    </div>
                  </div>
                </div>

                <span
                  v-if="member.role === '관리자'"
                  class="role-badge role-admin"
                >
                  관리자
                </span>
                <span
                  v-else
                  class="role-badge role-member"
                >
                  멤버
                </span>
              </div>
            </div>

            <EmptyState
              v-else
              title="멤버가 없습니다"
              description="아직 가입한 멤버가 없습니다."
            >
              <template #icon>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </template>
            </EmptyState>
          </div>
        </template>

        <!-- 탭 콘텐츠: 랭킹 -->
        <div v-else-if="activeTab === 'ranking'" class="section-card fade-in">
          <div class="section-header">
            <h3 class="section-title">그룹 랭킹</h3>
          </div>
          <GroupLeaderboard
            :group-id="groupId"
            :plan-id="selectedPlanId || undefined"
          />
        </div>

        <!-- 탭 콘텐츠: 달력 -->
        <div v-else-if="activeTab === 'calendar'" class="section-card fade-in">
          <div class="section-header">
            <h3 class="section-title">멤버 진도 달력</h3>
          </div>
          <GroupMemberCalendar
            :group-id="groupId"
            :plans="currentGroup.plans || []"
          />
        </div>
      </template>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { useGroupsStore } from '~/stores/groups'
import { useAuthService } from '~/composables/useAuthService'
import SkeletonProfileHeader from '~/components/ui/skeleton/SkeletonProfileHeader.vue'
import SkeletonStats from '~/components/ui/skeleton/SkeletonStats.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'
import PageLayout from '~/components/common/PageLayout.vue'
import Card from '~/components/common/Card.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import GroupPlanCalendar from '~/components/groups/GroupPlanCalendar.vue'
import GroupLeaderboard from '~/components/groups/GroupLeaderboard.vue'
import GroupMemberCalendar from '~/components/groups/GroupMemberCalendar.vue'
import { useModal } from '~/composables/useModal'

// 탭 아이콘 컴포넌트
const IconInfo = defineComponent({
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('line', { x1: 12, y1: 16, x2: 12, y2: 12 }),
      h('line', { x1: 12, y1: 8, x2: 12.01, y2: 8 })
    ])
  }
})

const IconRanking = defineComponent({
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('path', { d: 'M12 15l-2 5l9-11h-5l2-5l-9 11h5z' })
    ])
  }
})

const IconCalendar = defineComponent({
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
      h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
      h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
      h('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
    ])
  }
})

const route = useRoute()
const groupsStore = useGroupsStore()
const auth = useAuthService()
const modal = useModal()

const groupId = computed(() => parseInt(route.params.id as string))
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const currentGroup = computed(() => groupsStore.currentGroup)
const currentGroupMembers = computed(() => groupsStore.currentGroupMembers)

const isLoading = ref(true)
const isMembersLoading = ref(true)
const isActionLoading = ref(false)
const error = ref<string | null>(null)
const selectedPlanId = ref<number | null>(null)
const activeTab = ref<'info' | 'ranking' | 'calendar'>('info')

const tabs = [
  { value: 'info' as const, label: '정보', icon: IconInfo },
  { value: 'ranking' as const, label: '랭킹', icon: IconRanking },
  { value: 'calendar' as const, label: '달력', icon: IconCalendar }
]

// 그룹 정보 로드
onMounted(async () => {
  await loadGroupData()
})

const loadGroupData = async () => {
  isLoading.value = true
  isMembersLoading.value = true
  error.value = null

  try {
    // 그룹 상세 정보 가져오기
    const result = await groupsStore.fetchGroupDetail(groupId.value)

    if (!result.success) {
      error.value = result.error || '그룹 정보를 불러올 수 없습니다.'
      return
    }

    // 첫 번째 플랜을 기본 선택
    if (currentGroup.value?.plans && currentGroup.value.plans.length > 0) {
      selectedPlanId.value = currentGroup.value.plans[0].id
    }

    // 멤버 목록 가져오기
    await groupsStore.fetchGroupMembers(groupId.value)
  } catch (err: any) {
    error.value = err.message || '그룹 정보를 불러올 수 없습니다.'
  } finally {
    isLoading.value = false
    isMembersLoading.value = false
  }
}

// 그룹 가입
const handleJoinGroup = async () => {
  if (!isAuthenticated.value) {
    await modal.alert({
      title: '로그인 필요',
      description: '로그인이 필요합니다.',
      icon: 'warning'
    })
    navigateTo('/login')
    return
  }

  isActionLoading.value = true

  try {
    const result = await groupsStore.joinGroup(groupId.value)

    if (result.success) {
      // 그룹 정보 다시 로드
      await loadGroupData()
    } else {
      await modal.alert({
        title: '가입 실패',
        description: result.error || '그룹 가입에 실패했습니다.',
        icon: 'error'
      })
    }
  } catch (err: any) {
    await modal.alert({
      title: '가입 실패',
      description: err.message || '그룹 가입에 실패했습니다.',
      icon: 'error'
    })
  } finally {
    isActionLoading.value = false
  }
}

// 그룹 탈퇴
const handleLeaveGroup = async () => {
  const confirmed = await modal.confirm({
    title: '그룹 탈퇴',
    description: '정말로 이 그룹에서 탈퇴하시겠습니까?',
    confirmText: '탈퇴',
    cancelText: '취소',
    icon: 'warning'
  })
  if (!confirmed) return

  isActionLoading.value = true

  try {
    const result = await groupsStore.leaveGroup(groupId.value)

    if (result.success) {
      // 그룹 목록으로 이동
      navigateTo('/groups')
    } else {
      await modal.alert({
        title: '탈퇴 실패',
        description: result.error || '그룹 탈퇴에 실패했습니다.',
        icon: 'error'
      })
    }
  } catch (err: any) {
    await modal.alert({
      title: '탈퇴 실패',
      description: err.message || '그룹 탈퇴에 실패했습니다.',
      icon: 'error'
    })
  } finally {
    isActionLoading.value = false
  }
}

// 날짜 포맷팅
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 페이지 떠날 때 정리
onUnmounted(() => {
  groupsStore.currentGroup = null
  groupsStore.currentGroupMembers = []
})
</script>

<style scoped>
.content-wrapper {
  padding: 1rem;
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 카드 공통 스타일 */
.group-info-card,
.section-card {
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 에러 상태 */
.error-state {
  margin-top: 2rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem 1rem;
}

.error-content svg {
  color: var(--error-color, #EF4444);
}

.error-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.error-content p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

/* 그룹 헤더 */
.group-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1E293B;
  margin: 0;
  line-height: 1.3;
  font-family: 'Pretendard', sans-serif;
  letter-spacing: -0.02em;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
}

.status-public {
  background-color: #F0FDF4;
  color: #15803D;
  border: 1px solid #DCFCE7;
}

.status-private {
  background-color: #F8FAFC;
  color: #64748B;
  border: 1px solid #E2E8F0;
}

.member-count {
  font-size: 0.875rem;
  color: #64748B;
  font-family: 'Pretendard', sans-serif;
}

.group-description {
  font-size: 0.9375rem;
  color: #475569;
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

.group-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #F1F5F9;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.meta-label {
  color: #94A3B8;
  min-width: 3rem;
}

.meta-value, .plan-text {
  color: #334155;
  font-weight: 500;
}

/* 액션 버튼 */
.action-buttons {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #F1F5F9;
}

.btn-action {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

.btn-primary {
  background: #1E293B;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #334155;
  transform: translateY(-1px);
}

.btn-danger {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-bg);
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(0.96);
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
}

.admin-box {
  background: #FFFBEB;
  color: #B45309;
  border: 1px solid #FEF3C7;
}

.full-box {
  background: #F1F5F9;
  color: #64748B;
  border: 1px solid #E2E8F0;
}

/* 탭 네비게이션 */
.tab-navigation {
  display: flex;
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 0.25rem;
  gap: 0.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748B;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

.tab-button:hover {
  background: #F8FAFC;
  color: #475569;
}

.tab-button.active {
  background: #1E293B;
  color: white;
  font-weight: 600;
}

.tab-icon {
  flex-shrink: 0;
}

/* 플랜 선택 탭 */
.plan-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.plan-tab {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid #E2E8F0;
  background: white;
  color: #64748B;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

.plan-tab:hover {
  background: #F8FAFC;
  color: #475569;
}

.plan-tab.active {
  background: #1E293B;
  border-color: #1E293B;
  color: white;
}

.single-plan-name {
  padding: 0.75rem 1rem;
  background: #F8FAFC;
  color: #475569;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 1rem;
  border: 1px solid #E2E8F0;
}

/* 섹션 헤더 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1E293B;
  margin: 0;
  font-family: 'Pretendard', sans-serif;
}

.member-count-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #F1F5F9;
  color: #64748B;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* 멤버 목록 */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.member-item:hover {
  border-color: #E2E8F0;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.member-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #E2E8F0;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #F1F5F9;
  color: #64748B;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  border: 1px solid #E2E8F0;
}

.member-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.member-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1E293B;
}

.member-joined {
  font-size: 0.75rem;
  color: #94A3B8;
}

.role-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.role-admin {
  background: #FFFBEB;
  color: #B45309;
  border: 1px solid #FEF3C7;
}

.role-member {
  background: white;
  color: #64748B;
  border: 1px solid #E2E8F0;
}

/* 애니메이션 */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

.delay-100 {
  animation-delay: 0.1s;
}

.delay-200 {
  animation-delay: 0.2s;
}

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

/* 반응형 */
@media (max-width: 640px) {
  .group-name {
    font-size: 1.25rem;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-action,
  .status-box {
    width: 100%;
  }

  .tab-button {
    font-size: 0.8125rem;
    padding: 0.5rem;
  }
}

/* 다크모드 */
[data-theme="dark"] .group-info-card,
[data-theme="dark"] .section-card {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .group-name {
  color: var(--color-text-primary);
}

[data-theme="dark"] .group-description {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tab-navigation {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .tab-button {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tab-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .tab-button.active {
  background: var(--color-accent-primary);
  color: #ffffff;
}

[data-theme="dark"] .member-item {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

[data-theme="dark"] .member-name {
  color: var(--color-text-primary);
}

[data-theme="dark"] .meta-label {
  color: var(--color-text-muted);
}

[data-theme="dark"] .meta-value,
[data-theme="dark"] .plan-text {
  color: var(--color-text-primary);
}

[data-theme="dark"] .plan-tab {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

[data-theme="dark"] .plan-tab.active {
  background: var(--color-accent-primary);
  color: #ffffff;
  border-color: transparent;
}

[data-theme="dark"] .single-plan-name {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
</style>
