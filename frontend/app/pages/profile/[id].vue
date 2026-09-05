<template>
  <PageLayout title="내 정보">
    <template #header-action>
      <button v-if="isOwnProfile" type="button" class="settings-button" aria-label="계정 설정" @click="navigateToAccountSettings">
        <SettingsIcon :size="20" aria-hidden="true" />
      </button>
    </template>
    <div class="content-wrapper">
      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="profile-card fade-in">
        <SkeletonProfileHeader />
        <SkeletonStats :count="4" />
      </div>

      <template v-else-if="profile">
        <!-- 프로필 카드 -->
        <div class="profile-card fade-in delay-100">
          <div class="profile-header">
            <div class="profile-user">
              <div class="avatar-wrapper">
                <NuxtImg
                  v-if="profile.user.profile_image && !avatarError"
                  :src="profile.user.profile_image"
                  :alt="profile.user.nickname"
                  class="profile-avatar"
                  loading="lazy"
                  @error="handleAvatarError"
                />
                <div v-else class="profile-avatar-placeholder">
                  <UserIcon :size="36" />
                </div>
              </div>
              <div class="profile-info">
                <h2 class="profile-name">{{ profile.user.nickname }}</h2>
                <p class="profile-meta">{{ formatDate(profile.joined_date) }}부터</p>
                <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>
                <div class="follow-stats">
                  <button @click="showFollowers = true" class="follow-button">
                    팔로워 <span class="follow-count">{{ profile.followers_count }}</span>
                  </button>
                  <button @click="showFollowing = true" class="follow-button">
                    팔로잉 <span class="follow-count">{{ profile.following_count }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="profile.is_mutual_follow" class="mutual-follow">
              <UserRoundCheckIcon :size="16" aria-hidden="true" />
              서로 팔로우 중
            </div>
            <div class="profile-actions">
              <AppButton
                v-if="isOwnProfile"
                variant="secondary"
                size="md"
                @click="showEditModal = true"
              >
                프로필 편집
              </AppButton>
              <AppButton
                v-else-if="isAuthenticated"
                :variant="profile.is_following ? 'secondary' : 'primary'"
                size="md"
                @click="toggleFollow"
              >
                {{ profile.is_following ? '팔로잉' : '팔로우' }}
              </AppButton>
              <AppButton variant="secondary" size="md" @click="shareProfile">공유</AppButton>
            </div>
            <div v-if="isOwnProfile" class="settings-links">
              <button type="button" @click="navigateToAccountSettings">계정 설정</button>
              <button type="button" @click="navigateToNotificationSettings">알림 설정</button>
            </div>
          </div>

        </div>

        <div class="statistics-card fade-in delay-200">
          <RingProgress :size="96" :thickness="8" :value="Math.round(completionRate)" sublabel="완료율" />
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">완료한 일수</div>
              <div class="stat-value">{{ profile.total_completed_days }}<span class="stat-unit">일</span></div>
            </div>
            <div class="stat-item">
              <div class="stat-label">현재 연속</div>
              <div class="stat-value accent">{{ profile.current_streak }}<span class="stat-unit">일</span></div>
            </div>
            <div class="stat-item">
              <div class="stat-label">최장 연속</div>
              <div class="stat-value">{{ profile.longest_streak }}<span class="stat-unit">일</span></div>
            </div>
            <div class="stat-item">
              <div class="stat-label">하세나</div>
              <div class="stat-value" aria-label="하세나 기록 제공 안 됨" title="프로필에서 하세나 기록을 제공하지 않습니다">-<span class="stat-unit">회</span></div>
            </div>
          </div>
        </div>

        <!-- 탭 네비게이션 -->
        <div class="tab-section fade-in delay-300">
          <nav class="tab-nav" role="tablist" aria-label="프로필 정보">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :id="`profile-tab-${tab.id}`"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.id"
              :aria-controls="`profile-panel-${tab.id}`"
              @click="activeTab = tab.id"
              :class="[
                'tab-button',
                activeTab === tab.id ? 'active' : ''
              ]"
            >
              {{ tab.label }}
            </button>
          </nav>

          <!-- 탭 컨텐츠 -->
          <div :id="`profile-panel-${activeTab}`" class="tab-content" role="tabpanel" :aria-labelledby="`profile-tab-${activeTab}`">
            <!-- 달력 탭 -->
            <div v-if="activeTab === 'calendar'" class="calendar-tab-content">
              <SkeletonCalendar v-if="loadingStates.calendar" />
              <ProfileCalendar
                v-else-if="profile"
                :calendar-data="calendarData"
                :plans="calendarPlans"
                :user-id="userId"
                @month-change="handleMonthChange"
                @navigate-to-date="handleNavigateToDate"
              />
            </div>

            <!-- 업적 탭 -->
            <div v-else-if="activeTab === 'achievements'">
              <SkeletonList v-if="loadingStates.achievements" :count="4" variant="note" />
              <ProfileAchievements
                v-else-if="profile"
                :achievements-data="achievementsData"
                :plans="calendarPlans"
              />
            </div>

            <!-- 그룹 탭 -->
            <div v-else-if="activeTab === 'groups'">
              <div v-if="loadingStates.groups" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonGroupCard v-for="i in 3" :key="i" />
              </div>
              <ProfileGroups
                v-else-if="profile"
                :groups-data="groupsData"
              />
            </div>
          </div>
        </div>
      </template>

      <ErrorState v-else-if="error" :message="error" />

      <!-- 팔로워 모달 -->
      <FollowersModal
        v-if="showFollowers && profile"
        :is-open="showFollowers"
        :followers-data="followersData"
        :is-loading="loadingStates.followers"
        @close="showFollowers = false"
        @toggle-follow="handleToggleFollow"
      />

      <!-- 팔로잉 모달 -->
      <FollowingModal
        v-if="showFollowing && profile"
        :is-open="showFollowing"
        :following-data="followingData"
        :is-loading="loadingStates.following"
        @close="showFollowing = false"
        @unfollow="handleUnfollow"
      />

      <!-- 프로필 편집 모달 -->
      <ProfileEditModal
        v-if="showEditModal && profile"
        :profile="profile"
        @close="showEditModal = false"
        @saved="handleProfileSaved"
      />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { useAuthService } from '~/composables/useAuthService'
import { useProfilePageData } from '~/composables/useProfilePageData'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import RingProgress from '~/components/ui/RingProgress.vue'
import { useToast } from '~/composables/useToast'
import ErrorState from '~/components/ErrorState.vue'
import ProfileCalendar from '~/components/profile/ProfileCalendar.vue'
import ProfileAchievements from '~/components/profile/ProfileAchievements.vue'
import ProfileGroups from '~/components/profile/ProfileGroups.vue'
import FollowersModal from '~/components/profile/FollowersModal.vue'
import FollowingModal from '~/components/profile/FollowingModal.vue'
import ProfileEditModal from '~/components/profile/ProfileEditModal.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import SkeletonProfileHeader from '~/components/ui/skeleton/SkeletonProfileHeader.vue'
import SkeletonStats from '~/components/ui/skeleton/SkeletonStats.vue'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'
import SkeletonGroupCard from '~/components/ui/skeleton/SkeletonGroupCard.vue'
import { SettingsIcon, UserIcon, UserRoundCheckIcon } from '@lucide/vue'

const route = useRoute()
const auth = useAuthService()
const toast = useToast()

const shareProfile = async () => {
  const url = new URL(`/profile/${userId.value}`, window.location.origin).href
  try {
    if (navigator.share) {
      await navigator.share({ title: `${profile.value?.user.nickname}님의 프로필`, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('프로필 링크를 복사했습니다')
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    toast.error('프로필을 공유하지 못했습니다. 다시 시도해주세요.')
  }
}

const userId = computed(() => parseInt(route.params.id as string))

// Composable 사용
const {
  loadingStates,
  errors,
  profile,
  calendarData,
  calendarPlans,
  achievements,
  groups,
  followers,
  following,
  isOwnProfile,
  completionRate,
  loadInitialData,
  loadTabData,
  loadFollowers,
  loadFollowing,
  handleMonthChange,
  toggleFollow,
  handleToggleFollowInModal,
  handleUnfollowInModal,
  cleanup
} = useProfilePageData(userId)

// 로컬 상태
const activeTab = ref('calendar')
const showFollowers = ref(false)
const showFollowing = ref(false)
const showEditModal = ref(false)
const avatarError = ref(false)

const handleAvatarError = () => {
  avatarError.value = true
}

const navigateToAccountSettings = () => {
  navigateTo('/account/settings')
}

const navigateToNotificationSettings = () => {
  navigateTo('/notifications/settings')
}

// 로딩/에러 상태
const isLoading = computed(() => loadingStates.profile)
const error = computed(() => errors.value.length > 0 ? errors.value[0] : null)
const isAuthenticated = computed(() => auth.isAuthenticated.value)

// 데이터 computed (하위 호환성)
const achievementsData = computed(() => achievements.value || [])
const groupsData = computed(() => groups.value || [])
const followersData = computed(() => followers.value || [])
const followingData = computed(() => following.value || [])

const tabs = [
  { id: 'calendar', label: '달력' },
  { id: 'achievements', label: '업적' },
  { id: 'groups', label: '그룹' }
]

// 초기 로드
onMounted(() => {
  loadInitialData()
})

// 탭 변경 시 지연 로드
watch(activeTab, (newTab) => {
  loadTabData(newTab)
})

// 팔로워 모달 열 때 로드
watch(showFollowers, (isOpen) => {
  if (isOpen) loadFollowers()
})

// 팔로잉 모달 열 때 로드
watch(showFollowing, (isOpen) => {
  if (isOpen) loadFollowing()
})

// route 변경 감지 (다른 프로필로 이동 시)
watch(() => route.params.id, (newId, oldId) => {
  if (newId !== oldId) {
    cleanup()
    activeTab.value = 'calendar'
    avatarError.value = false
    loadInitialData()
  }
})

// 팔로워 모달에서 팔로우 토글
const handleToggleFollow = (follower: any) => {
  handleToggleFollowInModal(follower)
}

// 팔로잉 모달에서 언팔로우
const handleUnfollow = (user: any) => {
  handleUnfollowInModal(user)
}

// 날짜 포맷
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long'
  })
}

// 프로필 캘린더에서 일정 클릭 시 읽기 페이지로 이동
const handleNavigateToDate = (_schedule: any) => {
  // ScheduleDetailModal에서 이미 라우터 네비게이션을 처리하므로 추가 처리 불필요
}

// 프로필 편집 저장 후 처리
const handleProfileSaved = () => {
  // 프로필 데이터 다시 로드
  loadInitialData()
}

// 페이지 떠날 때 정리
onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.content-wrapper {
  padding: var(--screen-gutter);
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  letter-spacing: var(--tracking-body);
}
.profile-card { padding-block: 4px; }
.profile-header { display: flex; flex-direction: column; gap: 12px; }
.profile-user { display: flex; align-items: center; gap: 16px; }
.avatar-wrapper { flex-shrink: 0; }
.profile-avatar,
.profile-avatar-placeholder { width: 64px; height: 64px; border-radius: 50%; }
.profile-avatar { display: block; object-fit: cover; }
.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}
.profile-info { flex: 1; min-width: 0; }
.profile-name {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: var(--tracking-display);
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}
.profile-meta,
.profile-bio { margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.profile-bio { margin-top: 4px; overflow-wrap: anywhere; }
.follow-stats { display: flex; flex-wrap: wrap; gap: 12px; }
.follow-button,
.settings-links button,
.settings-button {
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color var(--duration-micro) ease, background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.follow-count { color: var(--color-text-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
.mutual-follow { display: flex; align-items: center; gap: 4px; color: var(--color-accent-primary); font-size: 12px; }
.profile-actions { display: flex; gap: 8px; }
.profile-actions > * { flex: 1; }
.settings-links { display: flex; gap: 20px; }
.settings-button { display: grid; place-items: center; border-radius: 50%; }
.settings-button:hover { background: var(--color-bg-hover); }
.follow-button:hover,
.settings-links button:hover { color: var(--color-accent-primary); }
.statistics-card,
.tab-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.statistics-card { display: flex; align-items: center; gap: 24px; padding: 18px 20px; }
.stats-grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 8px; }
.stat-item { display: flex; flex-direction: column; gap: 6px; }
.stat-label { color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
.stat-value { color: var(--color-text-primary); font-size: 20px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: var(--tracking-display); }
.stat-value.accent { color: var(--color-accent-primary); }
.stat-unit { margin-left: 2px; font-size: 13px; font-weight: 600; }
.tab-section { overflow: hidden; }
.tab-nav { display: flex; border-bottom: 1px solid var(--color-border-light); }
.tab-button {
  flex: 1;
  min-height: var(--hit-min);
  padding: 0 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--duration-micro) ease, background-color var(--duration-micro) ease, border-color var(--duration-standard) ease, transform var(--duration-micro) ease;
}
.tab-button:hover { background: var(--color-bg-hover); }
.tab-button.active { color: var(--color-text-primary); font-weight: 700; border-bottom: 2px solid var(--color-accent-primary); }
.tab-content { min-height: 280px; }
.calendar-tab-content { position: relative; }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
button:active { transform: scale(0.97); }
.delay-100 { animation-delay: var(--stagger); }
.delay-200 { animation-delay: calc(var(--stagger) * 2); }
.delay-300 { animation-delay: calc(var(--stagger) * 3); }
@media (max-width: 359px) {
  .statistics-card { gap: 12px; padding-inline: 12px; }
  .follow-stats { gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  button:active { transform: none; }
}
</style>
