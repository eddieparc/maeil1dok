<template>
  <PageLayout title="프로필">
    <div class="content-wrapper">
      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="profile-card fade-in">
        <SkeletonProfileHeader />
        <SkeletonStats :count="3" />
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
                <p class="profile-meta">가입일: {{ formatDate(profile.joined_date) }}</p>
                <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>
              </div>
            </div>

            <div class="profile-actions">
              <button
                v-if="isOwnProfile"
                @click="showEditModal = true"
                class="btn-action btn-secondary"
              >
                프로필 편집
              </button>
              <button
                v-if="isOwnProfile"
                @click="navigateToAccountSettings"
                class="btn-action btn-secondary"
              >
                계정 설정
              </button>
              <button
                v-else-if="isAuthenticated"
                @click="toggleFollow"
                :class="[
                  'btn-action',
                  profile.is_following ? 'btn-secondary' : 'btn-primary'
                ]"
              >
                {{ profile.is_following ? '언팔로우' : '팔로우' }}
              </button>
            </div>
          </div>

          <!-- 팔로워/팔로잉 -->
          <div class="follow-stats">
            <button @click="showFollowers = true" class="follow-button">
              <span class="follow-count">{{ profile.followers_count }}</span> 팔로워
            </button>
            <button @click="showFollowing = true" class="follow-button">
              <span class="follow-count">{{ profile.following_count }}</span> 팔로잉
            </button>
            <div v-if="profile.is_mutual_follow" class="mutual-follow">
              <UserRoundCheckIcon :size="16" />
              서로 팔로우 중
            </div>
          </div>

          <!-- 통계 그리드 -->
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">완료한 일수</div>
              <div class="stat-value primary">{{ profile.total_completed_days }}일</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">현재 연속</div>
              <div class="stat-value success">{{ profile.current_streak }}일</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">최장 연속</div>
              <div class="stat-value purple">{{ profile.longest_streak }}일</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">완료율</div>
              <div class="stat-value orange">{{ completionRate.toFixed(1) }}%</div>
            </div>
          </div>
        </div>

        <!-- 탭 네비게이션 -->
        <div class="tab-section fade-in delay-200">
          <nav class="tab-nav">
            <button
              v-for="tab in tabs"
              :key="tab.id"
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
          <div class="tab-content">
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
import LoadingState from '~/components/LoadingState.vue'
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
import { UserIcon, UserRoundCheckIcon } from '@lucide/vue'

const route = useRoute()
const auth = useAuthService()

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
    month: 'long',
    day: 'numeric'
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
/* ========================================
   프로필 페이지 - 홈 디자인 시스템 통일
   ======================================== */

.content-wrapper {
  padding: 1rem;
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ========================================
   프로필 카드
   ======================================== */
.profile-card {
  background: var(--color-bg-card, #fff);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(44, 51, 51, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.02);
}

[data-theme="dark"] .profile-card {
  background: var(--color-bg-card);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

/* 프로필 헤더 - 모바일 퍼스트 */
.profile-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.profile-user {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-wrapper {
  flex-shrink: 0;
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-bg-card, #fff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .profile-avatar {
  border-color: var(--color-bg-tertiary);
}

.profile-avatar-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary, #4A5D53) 0%, var(--color-accent-primary-hover) 100%);
  color: white;
  font-size: 1.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .profile-avatar-placeholder {
  background: linear-gradient(135deg, var(--color-accent-primary, #6bc99f) 0%, #4A9D6E 100%);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary, #2C3333);
  margin: 0 0 0.25rem 0;
  font-family: 'Pretendard', sans-serif;
  letter-spacing: -0.02em;
}

[data-theme="dark"] .profile-name {
  color: var(--color-text-primary, #f3f4f6);
}

.profile-meta {
  color: var(--color-text-secondary, #6B7280);
  font-size: 0.8125rem;
  margin: 0;
}

[data-theme="dark"] .profile-meta {
  color: var(--color-text-secondary);
}

.profile-bio {
  color: var(--color-text-secondary, #6B7280);
  margin: 0.5rem 0 0 0;
  line-height: 1.5;
  font-size: 0.875rem;
}

[data-theme="dark"] .profile-bio {
  color: var(--color-text-secondary);
}

.profile-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
  font-family: 'Pretendard', sans-serif;
}

.btn-primary {
  background: var(--color-accent-primary, #4A5D53);
  color: white;
}

[data-theme="dark"] .btn-primary {
  background: var(--color-accent-primary, #6bc99f);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--color-bg-tertiary, #F3F4F6);
  border: 1px solid var(--color-border-default, #E5E7EB);
  color: var(--color-text-primary, #2C3333);
}

[data-theme="dark"] .btn-secondary {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: var(--color-bg-hover, #E5E7EB);
}

[data-theme="dark"] .btn-secondary:hover {
  background: var(--color-bg-hover);
}

/* ========================================
   팔로우 통계
   ======================================== */
.follow-stats {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem 0;
  border-top: 1px solid var(--color-border-light, #F1F5F9);
  border-bottom: 1px solid var(--color-border-light, #F1F5F9);
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

[data-theme="dark"] .follow-stats {
  border-color: var(--color-border-default);
}

.follow-button {
  background: none;
  border: none;
  color: var(--color-text-secondary, #6B7280);
  cursor: pointer;
  transition: color 0.2s ease;
  padding: 0.25rem 0;
  font-size: 0.875rem;
  font-family: 'Pretendard', sans-serif;
}

[data-theme="dark"] .follow-button {
  color: var(--color-text-secondary);
}

.follow-button:hover {
  color: var(--color-text-primary, #2C3333);
}

[data-theme="dark"] .follow-button:hover {
  color: var(--color-text-primary);
}

.follow-count {
  font-weight: 700;
  color: var(--color-text-primary, #2C3333);
  margin-right: 0.25rem;
}

[data-theme="dark"] .follow-count {
  color: var(--color-text-primary);
}

.mutual-follow {
  color: var(--color-success-text);
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  background: var(--color-success-bg);
  padding: 0.375rem 0.625rem;
  border-radius: 999px;
}

/* ========================================
   통계 그리드
   ======================================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  background: var(--color-bg-tertiary, #F9FAFB);
  border-radius: 12px;
  transition: transform 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
}

[data-theme="dark"] .stat-item {
  background: var(--color-bg-tertiary);
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  font-family: 'Pretendard', sans-serif;
}

.stat-value.primary { 
  color: var(--color-text-primary, #2C3333); 
}
[data-theme="dark"] .stat-value.primary { 
  color: var(--color-text-primary); 
}

.stat-value.success {
  color: var(--color-success);
}

.stat-value.purple {
  color: var(--color-accent-secondary);
}

.stat-value.orange {
  color: var(--color-warning);
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--color-text-secondary, #6B7280);
  font-weight: 500;
  text-align: center;
}

[data-theme="dark"] .stat-label {
  color: var(--color-text-secondary);
}

/* ========================================
   탭 섹션
   ======================================== */
.tab-section {
  background: var(--color-bg-card, #fff);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(44, 51, 51, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.02);
}

[data-theme="dark"] .tab-section {
  background: var(--color-bg-card);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

.tab-nav {
  display: flex;
  padding: 0.5rem;
  gap: 0.25rem;
  background: var(--color-bg-tertiary, #F9FAFB);
}

[data-theme="dark"] .tab-nav {
  background: var(--color-bg-tertiary);
}

.tab-button {
  flex: 1;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6B7280);
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

[data-theme="dark"] .tab-button {
  color: var(--color-text-secondary);
}

.tab-button:hover:not(.active) {
  color: var(--color-text-primary, #2C3333);
  background: rgba(0, 0, 0, 0.03);
}

[data-theme="dark"] .tab-button:hover:not(.active) {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.tab-button.active {
  color: var(--color-text-primary, #2C3333);
  background: var(--color-bg-card, #fff);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .tab-button.active {
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.tab-content {
  min-height: 280px;
  padding: 0;
}

.calendar-tab-content {
  position: relative;
}

/* ========================================
   애니메이션
   ======================================== */
.fade-in {
  animation: fadeIn 0.3s ease-out forwards;
  opacity: 0;
}

.delay-100 { animation-delay: 0.05s; }
.delay-200 { animation-delay: 0.1s; }

@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translateY(8px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

/* ========================================
   반응형 - 태블릿/데스크탑
   ======================================== */
@media (min-width: 480px) {
  .profile-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .profile-user {
    flex: 1;
  }

  .profile-actions {
    flex-shrink: 0;
    flex: none;
  }

  .btn-action {
    flex: none;
    padding: 0.625rem 1.25rem;
  }

  .profile-avatar,
  .profile-avatar-placeholder {
    width: 80px;
    height: 80px;
  }

  .profile-avatar-placeholder {
    font-size: 2rem;
  }
}

/* 좁은 화면 최적화 */
@media (max-width: 359px) {
  .content-wrapper {
    padding: 0.75rem;
  }

  .profile-card,
  .tab-section {
    padding: 1rem;
    border-radius: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .stat-item {
    padding: 0.625rem 0.375rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .stat-label {
    font-size: 0.625rem;
  }

  .follow-stats {
    gap: 0.75rem;
  }

  .mutual-follow {
    width: 100%;
    justify-content: center;
    margin-left: 0;
    margin-top: 0.5rem;
  }
}
</style>
