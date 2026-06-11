<template>
  <div class="container">
    <!-- 고정 헤더 -->
    <PageHeader title="친구" fallback-path="/" />
    
    <!-- 스크롤 영역 -->
    <div class="scroll-area">
      <!-- 탭 -->
      <div class="tabs fade-in" style="animation-delay: 0.1s">
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'friends' }"
          @click="activeTab = 'friends'"
        >
          친구
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'followers' }"
          @click="activeTab = 'followers'"
        >
          팔로워
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'following' }"
          @click="activeTab = 'following'"
        >
          팔로잉
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'search' }"
          @click="activeTab = 'search'"
        >
          검색
        </button>
      </div>

      <!-- 검색 바 (검색 탭일 때만) -->
      <div v-if="activeTab === 'search'" class="search-bar fade-in" style="animation-delay: 0.2s">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="사용자 검색..."
          class="search-input"
          @input="searchUsers"
        >
      </div>

      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>로딩 중...</p>
      </div>
      
      <!-- 에러 상태 -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="() => { error = null; onMounted() }" class="retry-button">
          다시 시도
        </button>
      </div>
      
      <!-- 사용자 목록 -->
      <div v-else class="users-list">
        <!-- 친구 목록 -->
        <div v-if="activeTab === 'friends'">
          <div v-if="friendsList.length === 0" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>아직 친구가 없습니다</p>
            <p class="empty-subtitle">서로 팔로우하는 사용자가 친구로 표시됩니다</p>
          </div>
          <UserCard 
            v-for="user in friendsList" 
            :key="user.id"
            :user="user"
            @follow="handleFollow"
            @unfollow="handleUnfollow"
            class="fade-in"
          />
        </div>

        <!-- 팔로워 목록 -->
        <div v-else-if="activeTab === 'followers'">
          <div v-if="followersList.length === 0" class="empty-state">
            <p>팔로워가 없습니다</p>
          </div>
          <UserCard 
            v-for="user in followersList" 
            :key="user.id"
            :user="user"
            @follow="handleFollow"
            @unfollow="handleUnfollow"
            class="fade-in"
          />
        </div>

        <!-- 팔로잉 목록 -->
        <div v-else-if="activeTab === 'following'">
          <div v-if="followingList.length === 0" class="empty-state">
            <p>팔로잉하는 사용자가 없습니다</p>
          </div>
          <UserCard 
            v-for="user in followingList" 
            :key="user.id"
            :user="user"
            @follow="handleFollow"
            @unfollow="handleUnfollow"
            class="fade-in"
          />
        </div>

        <!-- 검색 결과 -->
        <div v-else-if="activeTab === 'search'">
          <div v-if="searchResults.length === 0 && searchQuery" class="empty-state">
            <p>검색 결과가 없습니다</p>
          </div>
          <div v-else-if="!searchQuery" class="empty-state">
            <p>사용자를 검색해보세요</p>
          </div>
          <UserCard 
            v-for="user in searchResults" 
            :key="user.id"
            :user="user"
            @follow="handleFollow"
            @unfollow="handleUnfollow"
            class="fade-in"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useSocialStore } from '~/stores/social'
import UserCard from '~/components/UserCard.vue'

const auth = useAuthService()
const socialStore = useSocialStore()

useHead({
  title: '친구 · 매일일독',
  meta: [
    { property: 'og:title', content: '친구 · 매일일독' },
    { property: 'og:description', content: '함께 통독하는 친구를 찾고 서로의 기록을 응원해 보세요.' },
    { name: 'description', content: '매일일독에서 친구를 팔로우하고 함께 통독을 이어갑니다.' },
  ],
})

const activeTab = ref('friends')
const searchQuery = ref('')

const friendsList = ref([])
const followersList = ref([])
const followingList = ref([])
const searchResults = ref([])

const isLoading = ref(false)
const error = ref(null)

// 친구 목록 가져오기
const fetchFriends = async () => {
  try {
    const response = await useApi().get('/api/v1/accounts/friends/')
    if (response.data?.success) {
      // 하위 호환: response.data.data?.friends 또는 response.data.friends
      const friends = response.data.data?.friends ?? response.data.friends ?? []
      friendsList.value = friends.map(friend => ({
        ...friend,
        is_friend: true,
        is_mutual_follow: true
      }))
    }
  } catch (err) {
    console.error('친구 목록 조회 실패:', err)
    error.value = '친구 목록을 불러올 수 없습니다.'
  }
}

// 팔로워 목록 가져오기
const fetchFollowers = async () => {
  if (!auth.user.value) return

  try {
    const response = await useApi().get(`/api/v1/accounts/followers/${auth.user.value.id}/`)
    if (response.data?.success) {
      // 하위 호환: response.data.data?.followers 또는 response.data.followers
      followersList.value = response.data.data?.followers ?? response.data.followers ?? []
    }
  } catch (error) {
    console.error('팔로워 목록 조회 실패:', error)
  }
}

// 팔로잉 목록 가져오기
const fetchFollowing = async () => {
  if (!auth.user.value) return

  try {
    const response = await useApi().get(`/api/v1/accounts/following/${auth.user.value.id}/`)
    if (response.data?.success) {
      // 하위 호환: response.data.data?.following 또는 response.data.following
      followingList.value = response.data.data?.following ?? response.data.following ?? []
    }
  } catch (error) {
    console.error('팔로잉 목록 조회 실패:', error)
  }
}

// 사용자 검색
const searchUsers = async () => {
  if (!searchQuery.value) {
    searchResults.value = []
    return
  }

  try {
    const response = await useApi().get('/api/v1/accounts/search/', {
      params: { q: searchQuery.value }
    })
    if (response.data?.success) {
      // 하위 호환: response.data.data?.users 또는 response.data.users
      searchResults.value = response.data.data?.users ?? response.data.users ?? []
    }
  } catch (error) {
    console.error('사용자 검색 실패:', error)
  }
}

// 로컬 목록에서 is_following 상태 업데이트 (낙관적 업데이트)
const updateLocalFollowStatus = (userId, isFollowing) => {
  // 팔로워 목록 업데이트
  followersList.value = followersList.value.map(user =>
    user.id === userId ? { ...user, is_following: isFollowing } : user
  )
  // 검색 결과 업데이트
  searchResults.value = searchResults.value.map(user =>
    user.id === userId ? { ...user, is_following: isFollowing } : user
  )
  // 팔로잉 목록 업데이트
  if (isFollowing) {
    // 팔로우 시: 팔로잉 목록에 추가 (이미 있으면 무시)
    const userToAdd = followersList.value.find(u => u.id === userId) ||
                      searchResults.value.find(u => u.id === userId)
    if (userToAdd && !followingList.value.some(u => u.id === userId)) {
      followingList.value.push({ ...userToAdd, is_following: true })
    }
  } else {
    // 언팔로우 시: 팔로잉 목록에서 제거
    followingList.value = followingList.value.filter(u => u.id !== userId)
    // 친구 목록에서도 제거 (상호 팔로우 깨짐)
    friendsList.value = friendsList.value.filter(u => u.id !== userId)
  }
}

// 팔로우 처리 (social store 사용 + 낙관적 업데이트)
const handleFollow = async (userId) => {
  // 사용자 정보 찾기 (낙관적 업데이트용)
  const userInfo = followersList.value.find(u => u.id === userId) ||
                   searchResults.value.find(u => u.id === userId)

  const result = await socialStore.followUser(userId, userInfo)
  if (result.success) {
    // 로컬 상태 낙관적 업데이트
    updateLocalFollowStatus(userId, true)
  } else {
    console.error('팔로우 실패:', result.error)
  }
}

// 언팔로우 처리 (social store 사용 + 낙관적 업데이트)
const handleUnfollow = async (userId) => {
  const result = await socialStore.unfollowUser(userId)
  if (result.success) {
    // 로컬 상태 낙관적 업데이트
    updateLocalFollowStatus(userId, false)
  } else {
    console.error('언팔로우 실패:', result.error)
  }
}

onMounted(async () => {
  // 비로그인 사용자는 로그인 페이지로 리다이렉트
  if (!auth.isAuthenticated.value) {
    navigateTo('/login')
    return
  }

  isLoading.value = true
  try {
    await Promise.all([
      fetchFriends(),
      fetchFollowers(),
      fetchFollowing()
    ])
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--color-bg-base, #F9FAFB);
  display: flex;
  flex-direction: column;
  max-width: 768px;
  margin: 0 auto;
}

.header {
  background: white;
  border-bottom: 1px solid #E5E7EB;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.back-button {
  padding: 0.5rem;
  margin: -0.5rem;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.back-button:hover {
  background-color: #F3F4F6;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.tabs {
  background: var(--color-bg-card, white);
  border: 1px solid var(--color-border-default, #E5E7EB);
  border-radius: 0.5rem;
  padding: 0.25rem;
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.tab-button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button.active {
  background: var(--primary-color);
  color: white;
}

.tab-button:not(.active):hover {
  background: var(--color-bg-hover, #F3F4F6);
}

.search-bar {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border-default, #E5E7EB);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: var(--color-bg-card, white);
  color: var(--color-text-primary, inherit);
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.empty-state svg {
  margin: 0 auto 1rem;
}

.empty-state p {
  margin: 0.5rem 0;
}

.empty-subtitle {
  font-size: 0.875rem;
  color: #9CA3AF;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.spinner {
  display: inline-block;
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border-default, #E5E7EB);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

/* 애니메이션 */
.fade-in {
  animation: fadeIn 0.3s ease-out forwards;
  opacity: 0;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

/* Tablet: iPad Mini and similar */
@media (min-width: 768px) {
  .content-wrapper {
    padding: 1.5rem;
  }

  .search-container {
    padding: 1.25rem;
  }

  .friends-list {
    padding: 1.25rem;
  }

  .friend-item {
    padding: 1.25rem;
  }

  .friend-avatar {
    width: 3.5rem;
    height: 3.5rem;
  }

  .friend-name {
    font-size: 1.125rem;
  }

  .friend-email {
    font-size: 0.9375rem;
  }

  .action-button {
    font-size: 0.9375rem;
    padding: 0.625rem 1.125rem;
  }
}

/* ===== 다크모드 ===== */
[data-theme="dark"] .container {
  background: var(--color-bg-primary);
}

[data-theme="dark"] .tabs {
  background: var(--color-bg-card);
  border: none;
  box-shadow: none;
}

[data-theme="dark"] .tab-button {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tab-button.active {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

[data-theme="dark"] .tab-button:not(.active):hover {
  background: var(--color-bg-hover);
}

[data-theme="dark"] .search-input {
  background: var(--color-bg-card);
  border: none;
  color: var(--color-text-primary);
}

[data-theme="dark"] .search-input::placeholder {
  color: var(--color-text-muted);
}

[data-theme="dark"] .search-input:focus {
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

[data-theme="dark"] .empty-state {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .empty-subtitle {
  color: var(--color-text-muted);
}

[data-theme="dark"] .loading-state,
[data-theme="dark"] .error-state {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .spinner {
  border-color: var(--color-border-default);
  border-top-color: var(--color-accent-primary);
}

[data-theme="dark"] .retry-button {
  background: var(--color-accent-primary);
}

[data-theme="dark"] .retry-button:hover {
  background: var(--color-accent-primary-hover, #3B7E63);
}

/* Tablet Large: iPad Pro and larger tablets */
@media (min-width: 1024px) {
  .content-wrapper {
    padding: 2rem;
  }

  .search-container {
    padding: 1.5rem;
  }

  .friends-list {
    padding: 1.5rem;
  }

  .friend-item {
    padding: 1.5rem;
  }

  .friend-avatar {
    width: 4rem;
    height: 4rem;
  }

  .friend-name {
    font-size: 1.25rem;
  }

  .friend-email {
    font-size: 1rem;
  }

  .action-button {
    font-size: 1rem;
    padding: 0.75rem 1.25rem;
  }
}
</style>