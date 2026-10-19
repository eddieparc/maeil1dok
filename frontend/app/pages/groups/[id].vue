<template>
  <PageLayout :title="currentGroup?.name || '그룹 정보'" fallback-path="/groups" class="group-detail-page">
    <template #header-action>
      <button v-if="currentGroup" class="more-button press" type="button" aria-label="그룹 더 보기" @click="showMore = true">
        <Ellipsis :size="20" aria-hidden="true" />
      </button>
    </template>
    <div class="content-wrapper">
      <div v-if="isLoading" class="loading-cards" aria-label="그룹을 불러오는 중" aria-busy="true">
        <ListCard><Skeleton width="80px" height="20px" /><Skeleton width="65%" height="28px" /><Skeleton height="60px" /></ListCard>
        <Skeleton width="240px" height="44px" />
        <ListCard><Skeleton v-for="i in 4" :key="i" height="56px" /></ListCard>
      </div>
      <ListCard v-else-if="error" class="error-state">
        <CircleAlert :size="48" aria-hidden="true" />
        <h2>그룹을 불러올 수 없습니다</h2>
        <p role="alert">{{ error }}</p>
        <AppButton variant="secondary" to="/groups">그룹 목록으로 돌아가기</AppButton>
      </ListCard>
      <template v-else-if="currentGroup">
        <ListCard class="group-info-card fade-in">
          <div class="header-top">
            <div class="badges">
              <span class="status-badge">{{ currentGroup.is_public ? '공개' : '비공개' }}</span>
              <span v-if="currentGroup.my_role === '관리자'" class="status-badge accent-badge">관리자</span>
              <span v-else-if="currentGroup.is_member" class="status-badge accent-badge">내 그룹</span>
            </div>
            <span class="member-count">{{ currentGroup.member_count }}/{{ currentGroup.max_members }}명</span>
          </div>
          <h2 class="group-name">{{ currentGroup.name }}</h2>
          <p class="group-description">{{ currentGroup.description || '설명이 없습니다.' }}</p>
          <div class="group-progress">
            <div class="progress-label"><span>그룹 평균 진도</span><strong>{{ averageProgress === null ? '-' : averageProgress }}%</strong></div>
            <div class="progress-track" role="progressbar" aria-label="그룹 평균 진도" :aria-valuenow="averageProgress ?? undefined" :aria-valuetext="averageProgress === null ? '진도 정보 없음' : `${averageProgress}%`" :aria-valuemin="0" :aria-valuemax="100">
              <div class="progress-fill" :style="{ width: `${averageProgress ?? 0}%` }" />
            </div>
            <p class="progress-caption">{{ selectedPlan?.name || '등록된 읽기표 없음' }}<template v-if="selectedPlan"> · 공개된 멤버 기록 기준</template></p>
            <p v-if="statsError" class="inline-error" role="status">{{ statsError }}</p>
          </div>
        </ListCard>

        <div class="tab-navigation fade-in" role="tablist" aria-label="그룹 상세">
          <FilterChip
            v-for="tab in tabs"
            :id="`group-tab-${tab.value}`"
            :key="tab.value"
            :label="tab.label"
            :count="tab.value === 'info' ? currentGroup.member_count : undefined"
            :active="activeTab === tab.value"
            role="tab"
            :aria-selected="activeTab === tab.value"
            :aria-controls="`group-panel-${tab.value}`"
            :tabindex="activeTab === tab.value ? 0 : -1"
            @click="activeTab = tab.value"
            @keydown="handleTabKeydown($event, tab.value)"
          />
        </div>

        <div v-if="activeTab === 'info'" id="group-panel-info" role="tabpanel" aria-labelledby="group-tab-info">
          <ListCard :padded="false" class="members-card fade-in">
            <div class="section-header"><h3>이번 주 멤버 현황</h3><span>{{ weekLabel }}</span></div>
            <p v-if="weekError" class="inline-error member-message" role="status">{{ weekError }}</p>
            <div v-if="isMembersLoading" class="member-loading" aria-busy="true"><Skeleton v-for="i in 4" :key="i" height="56px" /></div>
            <div v-else-if="currentGroupMembers.length" class="members-list">
              <div v-for="member in currentGroupMembers" :key="member.user.id" class="member-row list-card-row">
                <NuxtImg v-if="member.user.profile_image" :src="member.user.profile_image" alt="" class="member-avatar" loading="lazy" />
                <span v-else class="member-avatar avatar-placeholder" aria-hidden="true">{{ member.user.nickname?.charAt(0) || '?' }}</span>
                <div class="member-details">
                  <div class="member-name">{{ member.user.nickname }}<span v-if="member.role === '관리자'" class="leader-badge">리더</span></div>
                  <span class="member-streak">연속 {{ memberStats.get(member.user.id)?.current_streak ?? '-' }}일</span>
                </div>
                <div class="member-week" :aria-label="`${member.user.nickname} 주간 읽기 현황`" role="list">
                  <span v-for="day in weekDays" :key="day.key" class="week-cell" :class="weekState(member.user.id, day.key)" role="listitem" :aria-label="`${day.label}: ${weekStateLabel(member.user.id, day.key)}`" :title="`${day.label}: ${weekStateLabel(member.user.id, day.key)}`" />
                </div>
              </div>
            </div>
            <EmptyState v-else title="멤버가 없습니다" description="공개된 멤버 정보가 없습니다.">
              <template #icon><Users :size="48" aria-hidden="true" /></template>
            </EmptyState>
            <div class="week-legend"><span><i class="week-cell completed" />읽음</span><span><i class="week-cell today" />오늘</span><span><i class="week-cell upcoming" />예정</span></div>
          </ListCard>
        </div>

        <div v-else-if="activeTab === 'calendar'" id="group-panel-calendar" role="tabpanel" aria-labelledby="group-tab-calendar">
          <ListCard title="읽기 계획 일정" class="fade-in">
            <div v-if="currentGroup.plans.length > 1" class="plan-tabs">
              <FilterChip v-for="plan in currentGroup.plans" :key="plan.id" :label="plan.name" :active="selectedPlanId === plan.id" @click="handlePlanChange(plan.id)" />
            </div>
            <p v-else-if="selectedPlan" class="single-plan-name">{{ selectedPlan.name }}</p>
            <GroupPlanCalendar v-if="selectedPlanId" :plan-id="selectedPlanId" />
            <EmptyState v-else title="등록된 읽기표가 없습니다" description="그룹에 읽기표가 연결되면 일정을 볼 수 있어요." />
          </ListCard>
        </div>
        <!-- TODO(handoff-v2): No group board API is available; retain the honest unavailable state. -->
        <div v-else id="group-panel-board" role="tabpanel" aria-labelledby="group-tab-board">
          <ListCard class="fade-in">
            <EmptyState title="게시판 준비 중" description="아직 그룹 게시판 기능이 제공되지 않습니다.">
              <template #icon><MessageSquare :size="48" aria-hidden="true" /></template>
            </EmptyState>
          </ListCard>
        </div>
      </template>
    </div>

    <div v-if="currentGroup && !isLoading && !error" class="group-cta">
      <div class="group-cta-inner">
        <AppButton v-if="currentGroup.is_member" variant="primary" size="lg" block @click="handleOpenChat">그룹 채팅 열기</AppButton>
        <AppButton v-else variant="primary" size="lg" block :disabled="currentGroup.is_full" :loading="isActionLoading" @click="handleJoinGroup">{{ currentGroup.is_full ? '정원 초과' : '그룹 가입하기' }}</AppButton>
      </div>
    </div>
    <BottomSheet v-model="showMore" title="그룹 정보">
      <div v-if="currentGroup" class="more-content">
        <p>리더 · {{ currentGroup.creator?.nickname || '알 수 없음' }}</p>
        <p v-for="plan in currentGroup.plans" :key="plan.id">{{ plan.name }}</p>
        <AppButton variant="secondary" to="/scoreboard" block>리더보드</AppButton>
        <AppButton v-if="currentGroup.is_member && currentGroup.my_role !== '관리자'" variant="danger" block :loading="isActionLoading" @click="handleLeaveGroup">그룹 탈퇴하기</AppButton>
      </div>
    </BottomSheet>
  </PageLayout>
</template>

<script setup lang="ts">
import { CircleAlert, Ellipsis, MessageSquare, Users } from '@lucide/vue'
import { useGroupsStore } from '~/stores/groups'
import { useAuthService } from '~/composables/useAuthService'
import { useApi } from '~/composables/useApi'
import { useModal } from '~/composables/useModal'
import type { components } from '~/types/generated/api-schema'
import PageLayout from '~/components/common/PageLayout.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import AppButton from '~/components/ui/AppButton.vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import ListCard from '~/components/ui/ListCard.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import GroupPlanCalendar from '~/components/groups/GroupPlanCalendar.vue'

const route = useRoute()
const groupsStore = useGroupsStore()
const auth = useAuthService()
const api = useApi()
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
const selectedPlan = computed(() => currentGroup.value?.plans.find(plan => plan.id === selectedPlanId.value))
const activeTab = ref<'info' | 'calendar' | 'board'>('info')
const showMore = ref(false)
const tabs = [
  { value: 'info', label: '멤버' },
  { value: 'calendar', label: '일정' },
  { value: 'board', label: '게시판' }
] as const
const handleTabKeydown = (event: KeyboardEvent, value: typeof activeTab.value) => {
  const index = tabs.findIndex(tab => tab.value === value)
  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
    : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
  if (next === null) return
  event.preventDefault()
  activeTab.value = tabs[next]?.value ?? tabs[0].value
  document.getElementById(`group-tab-${activeTab.value}`)?.focus()
}

const today = new Date()
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const todayKey = dateKey(today)
const weekDays = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7 + index)
  return { date, key: dateKey(date), label: date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) }
})
const weekLabel = `${today.getMonth() + 1}월 ${Math.ceil((today.getDate() + (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7) / 7)}주`
const weekCalendar = ref<Record<string, components['schemas']['GroupProgressDay']>>({})
const stats = ref<components['schemas']['LeaderboardEntry'][]>([])
const statsError = ref('')
const weekError = ref('')
const memberStats = computed(() => new Map(stats.value.map(entry => [entry.user.id, entry])))
const averageProgress = computed(() => stats.value.length ? Math.round(stats.value.reduce((sum, entry) => sum + entry.progress_rate, 0) / stats.value.length) : null)
const weekState = (userId: number, key: string) => {
  if (key > todayKey) return 'upcoming'
  const record = weekCalendar.value[key]?.members.find(member => member.id === userId)
  if (record?.is_completed) return 'completed'
  if (key === todayKey) return 'today'
  return record ? 'pending' : 'unavailable'
}
const weekStateLabel = (userId: number, key: string) => ({ completed: '읽음', today: '오늘', upcoming: '예정', pending: '미완료', unavailable: '기록 정보 없음' })[weekState(userId, key)]

// 월 경계 주간도 기존 월별 API로 조회한다. 상세 화면의 스냅샷을 사용해 일정 탭의 store와 분리한다.
let activityRequest = 0
const loadActivity = async () => {
  const request = ++activityRequest
  const planId = selectedPlanId.value
  stats.value = []
  weekCalendar.value = {}
  statsError.value = ''
  weekError.value = ''
  if (!planId) return
  const months = [...new Map(weekDays.map(day => [day.key.slice(0, 7), day.date])).values()]
  await Promise.all([
    (async () => {
      try {
        const { data } = await api.GET(api.path('/api/v1/todos/scoreboard/group/{group_id}/', { group_id: groupId.value }), { params: { period: 'all', plan_id: planId } })
        if (!data?.success) throw new Error('그룹 진도를 불러올 수 없습니다.')
        if (request === activityRequest) stats.value = data.leaderboard ?? []
      } catch (err) {
        if (request === activityRequest) statsError.value = err instanceof Error ? err.message : '그룹 진도를 불러올 수 없습니다.'
      }
    })(),
    (async () => {
      try {
        const calendars = await Promise.all(months.map(async date => {
          const { data } = await api.GET(api.path('/api/v1/todos/groups/{group_id}/member-progress/', { group_id: groupId.value }), { params: { month: date.getMonth() + 1, year: date.getFullYear(), plan_id: planId } })
          if (!data?.success) throw new Error('주간 기록을 불러올 수 없습니다.')
          return data.calendar
        }))
        if (request === activityRequest) weekCalendar.value = Object.assign({}, ...calendars)
      } catch (err) {
        if (request === activityRequest) weekError.value = err instanceof Error ? err.message : '주간 기록을 불러올 수 없습니다.'
      }
    })()
  ])
}
const handlePlanChange = (planId: number) => {
  selectedPlanId.value = planId
  loadActivity()
}
const loadGroupData = async () => {
  isLoading.value = true
  isMembersLoading.value = true
  error.value = null
  try {
    const result = await groupsStore.fetchGroupDetail(groupId.value)
    if (!result.success) {
      error.value = result.error || '그룹 정보를 불러올 수 없습니다.'
      return
    }
    selectedPlanId.value = currentGroup.value?.plans[0]?.id ?? null
    await Promise.all([groupsStore.fetchGroupMembers(groupId.value), loadActivity()])
  } catch (err: any) {
    error.value = err.message || '그룹 정보를 불러올 수 없습니다.'
  } finally {
    isLoading.value = false
    isMembersLoading.value = false
  }
}
onMounted(loadGroupData)

const handleJoinGroup = async () => {
  if (!isAuthenticated.value) {
    await modal.alert({ title: '로그인 필요', description: '로그인이 필요합니다.', icon: 'warning' })
    navigateTo('/login')
    return
  }
  isActionLoading.value = true
  try {
    const result = await groupsStore.joinGroup(groupId.value)
    if (result.success) await loadGroupData()
    else await modal.alert({ title: '가입 실패', description: result.error || '그룹 가입에 실패했습니다.', icon: 'error' })
  } catch (err: any) {
    await modal.alert({ title: '가입 실패', description: err.message || '그룹 가입에 실패했습니다.', icon: 'error' })
  } finally {
    isActionLoading.value = false
  }
}
const handleLeaveGroup = async () => {
  showMore.value = false
  const confirmed = await modal.confirm({ title: '그룹 탈퇴', description: '정말로 이 그룹에서 탈퇴하시겠습니까?', confirmText: '탈퇴', confirmVariant: 'danger', cancelText: '취소', icon: 'warning' })
  if (!confirmed) return
  isActionLoading.value = true
  try {
    const result = await groupsStore.leaveGroup(groupId.value)
    if (result.success) navigateTo('/groups')
    else await modal.alert({ title: '탈퇴 실패', description: result.error || '그룹 탈퇴에 실패했습니다.', icon: 'error' })
  } catch (err: any) {
    await modal.alert({ title: '탈퇴 실패', description: err.message || '그룹 탈퇴에 실패했습니다.', icon: 'error' })
  } finally {
    isActionLoading.value = false
  }
}
// TODO(handoff-v2): 현재 앱에는 채팅 라우트/API가 없다. 존재하지 않는 경로로 이동하지 않는다.
const handleOpenChat = () => modal.alert({ title: '그룹 채팅', description: '아직 그룹 채팅 기능이 제공되지 않습니다.' })
onUnmounted(() => {
  activityRequest++
  groupsStore.currentGroup = null
  groupsStore.currentGroupMembers = []
})
</script>

<style scoped>
.group-detail-page :deep(.header) { min-height: 52px; padding: 0 20px; gap: 8px; }
.group-detail-page :deep(.header h1) { font-size: 16px; font-weight: 700; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-detail-page :deep(.back-button) { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; }
.group-detail-page :deep(.back-button:focus-visible) { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.content-wrapper { display: flex; flex-direction: column; gap: 14px; max-width: 768px; margin: 0 auto; padding: 20px 20px 100px; letter-spacing: var(--tracking-body); }
.loading-cards { display: flex; flex-direction: column; gap: 14px; }
.loading-cards :deep(.list-card__content), .member-loading { display: flex; flex-direction: column; gap: 12px; }
.header-top, .badges { display: flex; align-items: center; gap: 6px; }
.header-top { justify-content: space-between; gap: 12px; }
.status-badge { padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.accent-badge, .leader-badge { background: var(--color-accent-primary-light); color: var(--color-accent-primary); }
.member-count { color: var(--color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.group-name { margin: 12px 0 8px; color: var(--color-text-primary); font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: -0.6px; }
.group-description { margin: 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; }
.group-progress { border-top: 1px solid var(--color-border-light); padding-top: 14px; margin-top: 16px; }
.progress-label { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px; }
.progress-label strong { color: var(--color-accent-primary); font-variant-numeric: tabular-nums; }
.progress-track { height: 8px; overflow: hidden; background: var(--color-bg-hover); border-radius: 999px; }
.progress-fill { height: 100%; background: var(--color-accent-primary); border-radius: inherit; transition: width var(--duration-standard) ease; }
.progress-caption { color: var(--color-text-tertiary); font-size: 11px; margin: 8px 0 0; }
.tab-navigation, .plan-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 18px 20px 10px; }
.section-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.section-header > span { color: var(--color-text-tertiary); font-size: 12px; white-space: nowrap; }
.members-card :deep(.member-row) { display: flex; align-items: center; gap: 10px; padding: 10px 20px; min-height: 56px; }
.member-avatar { display: flex; align-items: center; justify-content: center; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.avatar-placeholder { background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 13px; font-weight: 700; }
.member-details { flex: 1; min-width: 0; }
.member-name { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--color-text-primary); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.leader-badge { padding: 3px 5px; border-radius: 999px; font-size: 10px; font-weight: 700; line-height: 1; }
.member-streak { display: block; color: var(--color-text-tertiary); font-size: 12px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.member-week { display: grid; grid-template-columns: repeat(7, 10px); gap: 3px; flex-shrink: 0; }
.week-cell { display: inline-block; box-sizing: border-box; width: 10px; height: 10px; border: 1px dashed var(--color-border-default); border-radius: 3px; background: var(--color-bg-card); }
.week-cell.completed { background: var(--color-accent-primary); border: 1px solid var(--color-accent-primary); }
.week-cell.today { background: var(--color-accent-primary-light); border: 1px solid var(--color-accent-primary); }
.week-cell.pending { border-color: var(--color-text-tertiary); }
.week-cell.unavailable { background: var(--color-bg-tertiary); border-style: solid; }
.week-legend { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 12px 20px 18px; color: var(--color-text-tertiary); font-size: 11px; }
.week-legend > span { display: inline-flex; align-items: center; gap: 4px; }
.inline-error { color: var(--color-error); font-size: 12px; margin: 10px 0 0; }
.member-message { padding: 0 20px 10px; }
.member-loading { padding: 10px 20px; }
.single-plan-name { color: var(--color-text-secondary); font-size: 13px; margin: 0 0 14px; }
.plan-tabs { margin-bottom: 14px; }
.more-button { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; border-radius: 50%; background: transparent; color: var(--color-text-primary); cursor: pointer; }
.more-button:hover { background: var(--color-bg-hover); }
.more-content { display: flex; flex-direction: column; gap: 12px; color: var(--color-text-secondary); font-size: 14px; }
.more-content p { margin: 0; }
.group-cta { position: fixed; right: 0; left: 0; bottom: calc(var(--tabbar-height) + max(env(safe-area-inset-bottom, 0px), var(--native-bottom-inset, 0px))); z-index: 20; background: linear-gradient(to bottom, transparent, var(--color-bg-primary) 24%); padding: 20px 20px 12px; pointer-events: none; }
.group-cta-inner { max-width: 728px; margin: 0 auto; pointer-events: auto; }
.error-state { text-align: center; color: var(--color-text-secondary); }
.error-state h2 { font-size: 18px; color: var(--color-text-primary); }
.error-state svg { color: var(--color-error); margin: 0 auto; }
[data-theme="dark"] .accent-badge, [data-theme="dark"] .leader-badge { background: transparent; outline: 1.5px solid var(--color-accent-primary); }
@media (min-width: 1024px) { .group-cta { left: var(--sidebar-width); bottom: 0; padding-bottom: 24px; } }
@media (prefers-reduced-motion: reduce) { .progress-fill { transition: none; } }
</style>
