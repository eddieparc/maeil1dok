<template>
  <PageLayout title="친구" fallback-path="/">
    <div class="friends-content stagger">
      <div class="search-bar fade-in">
        <SearchIcon :size="18" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="닉네임으로 검색"
          aria-label="닉네임으로 검색"
          class="search-input"
          @input="onSearchInput"
        >
      </div>

      <div class="tabs fade-in" role="group" aria-label="친구 목록 보기">
        <FilterChip label="친구" :count="friendsList.length" :active="activeTab === 'friends'" @click="selectTab('friends')" />
        <FilterChip label="팔로워" :count="followersList.length" :active="activeTab === 'followers'" @click="selectTab('followers')" />
        <FilterChip label="팔로잉" :count="followingList.length" :active="activeTab === 'following'" @click="selectTab('following')" />
      </div>

      <p v-if="followError" class="inline-error" role="alert">{{ followError }}</p>
      <SkeletonList v-if="isLoading || isSearching" :count="6" variant="user" />
      <div v-else-if="error" class="error-state" role="alert">
        <p>{{ error }}</p>
        <AppButton variant="secondary" @click="activeTab === 'search' ? searchUsers() : loadLists()">다시 시도</AppButton>
      </div>
      <ListCard v-else :padded="false" class="users-list fade-in">
        <div v-if="visibleUsers.length === 0" class="empty-state">
          <UsersIcon :size="40" aria-hidden="true" />
          <p>{{ emptyMessage }}</p>
          <p v-if="activeTab === 'friends'" class="empty-subtitle">서로 팔로우하는 사용자가 친구로 표시됩니다</p>
        </div>
        <div v-for="user in visibleUsers" :key="user.id" class="friend-row">
          <NuxtLink :to="`/profile/${user.id}`" class="friend-info">
            <NuxtImg
              v-if="user.profile_image && !avatarErrors[user.id]"
              :src="user.profile_image"
              :alt="user.nickname"
              class="friend-avatar"
              loading="lazy"
              @error="avatarErrors[user.id] = true"
            />
            <span v-else class="friend-avatar avatar-placeholder"><UserIcon :size="20" aria-hidden="true" /></span>
            <span class="friend-details">
              <span class="friend-heading">
                <span class="friend-name">{{ user.nickname }}</span>
                <UserCheckIcon v-if="user.is_mutual_follow || user.is_friend" :size="14" class="mutual-icon" aria-label="상호 팔로우" role="img" />
              </span>
              <span v-if="user.current_streak !== undefined && user.progress_rate !== undefined" class="friend-sub">연속 {{ user.current_streak }}일 · 진도 {{ user.progress_rate }}%</span>
              <span v-else-if="user.total_completed_days !== undefined" class="friend-sub">통독 {{ user.total_completed_days }}일 완료</span>
              <span v-else class="friend-sub">@{{ user.username }}</span>
            </span>
          </NuxtLink>
          <div v-if="auth.user.value?.id !== user.id" class="follow-hit-area">
            <button
              type="button"
              class="follow-toggle"
              :class="{ following: user.is_following }"
              :disabled="pendingFollows[user.id]"
              :aria-pressed="Boolean(user.is_following)"
              :aria-label="`${user.nickname} ${user.is_following ? '팔로잉 취소' : '팔로우'}`"
              :aria-busy="Boolean(pendingFollows[user.id])"
              @click="toggleFollow(user)"
            >{{ user.is_following ? '팔로잉' : '팔로우' }}</button>
          </div>
        </div>
      </ListCard>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { debounce } from 'lodash-es'
import { SearchIcon, UserIcon, UsersIcon, UserCheckIcon } from '@lucide/vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useSocialStore } from '~/stores/social'
import FilterChip from '~/components/ui/FilterChip.vue'
import ListCard from '~/components/ui/ListCard.vue'
import AppButton from '~/components/ui/AppButton.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import PageLayout from '~/components/common/PageLayout.vue'

const auth = useAuthService()
const socialStore = useSocialStore()
const api = useApi()

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
const isLoading = ref(true)
const isSearching = ref(false)
const error = ref(null)
const followError = ref(null)
const pendingFollows = ref({})
const avatarErrors = ref({})
let searchVersion = 0

const visibleUsers = computed(() => {
  if (activeTab.value === 'search') return searchResults.value
  if (activeTab.value === 'followers') return followersList.value
  if (activeTab.value === 'following') return followingList.value
  return friendsList.value
})
const emptyMessage = computed(() => ({
  friends: '아직 친구가 없습니다',
  followers: '팔로워가 없습니다',
  following: '팔로잉하는 사용자가 없습니다',
  search: '검색 결과가 없습니다'
})[activeTab.value])

const fetchFriends = async () => {
  try {
    const response = await api.GET('/api/v1/auth/friends/')
    if (!response.data?.success) throw new Error('친구 목록 조회 실패')
    friendsList.value = response.data.data.friends.map(friend => ({
      ...friend,
      is_following: true,
      is_friend: true,
      is_mutual_follow: true
    }))
  } catch (err) {
    console.error('친구 목록 조회 실패:', err)
    error.value = '친구 목록을 불러올 수 없습니다.'
  }
}

const fetchFollowers = async () => {
  if (!auth.user.value) return
  try {
    const response = await api.GET(
      api.path('/api/v1/auth/followers/{user_id}/', { user_id: auth.user.value.id })
    )
    if (!response.data?.success) throw new Error('팔로워 목록 조회 실패')
    followersList.value = response.data.data.followers.map(user => ({
      ...user, is_mutual_follow: user.is_following
    }))
  } catch (err) {
    console.error('팔로워 목록 조회 실패:', err)
    error.value = '팔로워 목록을 불러올 수 없습니다.'
  }
}

const fetchFollowing = async () => {
  if (!auth.user.value) return
  try {
    const response = await api.GET(
      api.path('/api/v1/auth/following/{user_id}/', { user_id: auth.user.value.id })
    )
    if (!response.data?.success) throw new Error('팔로잉 목록 조회 실패')
    followingList.value = response.data.data.following
  } catch (err) {
    console.error('팔로잉 목록 조회 실패:', err)
    error.value = '팔로잉 목록을 불러올 수 없습니다.'
  }
}

const searchUsers = async () => {
  const query = searchQuery.value.trim()
  const version = ++searchVersion
  if (!query) {
    searchResults.value = []
    isSearching.value = false
    return
  }
  isSearching.value = true
  error.value = null
  try {
    const response = await api.GET('/api/v1/auth/search/', { params: { q: query } })
    if (version !== searchVersion) return
    if (!response.data?.success) throw new Error('사용자 검색 실패')
    searchResults.value = response.data.data.users
  } catch (err) {
    console.error('사용자 검색 실패:', err)
    if (version === searchVersion) error.value = '사용자를 검색할 수 없습니다.'
  } finally {
    if (version === searchVersion) isSearching.value = false
  }
}
const debouncedSearch = debounce(searchUsers, 300)
const selectTab = (tab) => {
  debouncedSearch.cancel()
  searchVersion++
  searchQuery.value = ''
  searchResults.value = []
  isSearching.value = false
  error.value = null
  activeTab.value = tab
}
const onSearchInput = () => {
  searchVersion++
  searchResults.value = []
  error.value = null
  if (!searchQuery.value.trim()) {
    selectTab('friends')
    return
  }
  activeTab.value = 'search'
  isSearching.value = true
  debouncedSearch()
}

// 성공한 관계 변경은 기존 로컬 목록과 social store에 함께 반영한다.
const updateLocalFollowStatus = (userId, isFollowing) => {
  followersList.value = followersList.value.map(user =>
    user.id === userId ? { ...user, is_following: isFollowing, is_mutual_follow: isFollowing } : user
  )
  searchResults.value = searchResults.value.map(user =>
    user.id === userId ? { ...user, is_following: isFollowing } : user
  )
  if (isFollowing) {
    const userToAdd = followersList.value.find(u => u.id === userId) ||
                      searchResults.value.find(u => u.id === userId)
    if (userToAdd && !followingList.value.some(u => u.id === userId)) {
      followingList.value.push({ ...userToAdd, is_following: true })
    }
    if (userToAdd?.is_mutual_follow && !friendsList.value.some(u => u.id === userId)) {
      friendsList.value.push({ ...userToAdd, is_friend: true })
    }
  } else {
    followingList.value = followingList.value.filter(u => u.id !== userId)
    friendsList.value = friendsList.value.filter(u => u.id !== userId)
  }
}

const handleFollow = async (userId) => {
  const userInfo = followersList.value.find(u => u.id === userId) ||
                   searchResults.value.find(u => u.id === userId)
  const result = await socialStore.followUser(userId, userInfo)
  if (result.success) {
    updateLocalFollowStatus(userId, true)
  } else {
    console.error('팔로우 실패:', result.error)
  }
  return result
}

const handleUnfollow = async (userId) => {
  const result = await socialStore.unfollowUser(userId)
  if (result.success) {
    updateLocalFollowStatus(userId, false)
  } else {
    console.error('언팔로우 실패:', result.error)
  }
  return result
}

// 클릭 즉시 토글하되 요청이 끝날 때까지 중복 입력을 막고 실패 시 복원한다.
const toggleFollow = async (user) => {
  if (pendingFollows.value[user.id]) return
  const previous = user.is_following
  pendingFollows.value[user.id] = true
  followError.value = null
  user.is_following = !previous
  try {
    const result = await (previous ? handleUnfollow(user.id) : handleFollow(user.id))
    if (!result.success) {
      user.is_following = previous
      followError.value = result.error || '팔로우 상태를 변경할 수 없습니다.'
    }
  } catch (err) {
    user.is_following = previous
    console.error('팔로우 상태 변경 실패:', err)
    followError.value = '팔로우 상태를 변경할 수 없습니다.'
  } finally {
    delete pendingFollows.value[user.id]
  }
}

const loadLists = async () => {
  error.value = null
  isLoading.value = true
  try {
    await Promise.all([fetchFriends(), fetchFollowers(), fetchFollowing()])
    followingList.value = followingList.value.map(user => ({
      ...user, is_mutual_follow: friendsList.value.some(friend => friend.id === user.id)
    }))
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (!auth.isAuthenticated.value) {
    navigateTo('/login')
    return
  }
  await loadLists()
})
onBeforeUnmount(() => {
  debouncedSearch.cancel()
  searchVersion++
})
</script>

<style scoped>
.friends-content { width: 100%; max-width: 768px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; letter-spacing: var(--tracking-body); }
.search-bar { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-tertiary); }
.search-bar:focus-within { border-color: var(--color-accent-primary); box-shadow: 0 0 0 3px var(--color-accent-focus-ring); }
.search-input { width: 100%; min-width: 0; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 14px; }
.search-input::placeholder { color: var(--color-text-tertiary); }
.search-input:focus-visible { outline: none; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tabs :deep(.filter-chip) { padding-inline: 12px; }
.users-list { padding: 6px 0; }
.users-list:hover { box-shadow: var(--shadow-card); }
.friend-row { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 20px; }
.friend-row + .friend-row { border-top: 1px solid var(--color-border-light); }
.friend-info { display: flex; align-items: center; flex: 1; min-width: 0; min-height: 44px; gap: 10px; color: var(--color-text-primary); text-decoration: none; border-radius: var(--radius-control); transition: color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.friend-info:hover { color: var(--color-accent-primary); }
.friend-info:active, .follow-toggle:active { transform: scale(0.97); }
.friend-info:focus-visible, .follow-toggle:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
.friend-avatar { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; object-fit: cover; }
.avatar-placeholder { display: flex; align-items: center; justify-content: center; background: var(--color-bg-tertiary); color: var(--color-accent-primary); }
.friend-details { min-width: 0; }
.friend-heading { display: flex; align-items: center; gap: 4px; }
.friend-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.mutual-icon { flex-shrink: 0; color: var(--color-accent-primary); }
.friend-sub { display: block; margin-top: 2px; color: var(--color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.follow-hit-area { display: flex; align-items: center; min-height: 44px; flex-shrink: 0; }
.follow-toggle { position: relative; height: 32px; min-width: 64px; padding: 0 12px; border: 1px solid var(--color-accent-primary); border-radius: var(--radius-pill); background: var(--color-accent-primary); color: var(--color-text-inverse); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.follow-toggle::before { content: ''; position: absolute; inset: -6px 0; }
.follow-toggle:hover { background: var(--color-accent-primary-hover); }
.follow-toggle.following { background: var(--color-bg-card); border-color: var(--color-border-default); color: var(--color-text-secondary); }
.follow-toggle.following:hover { background: var(--color-bg-hover); }
.follow-toggle:disabled { cursor: wait; opacity: 0.5; }
.empty-state, .error-state { padding: 40px 20px; text-align: center; color: var(--color-text-secondary); font-size: 14px; }
.empty-state svg { display: block; margin: 0 auto 14px; color: var(--color-text-tertiary); }
.empty-state p { margin: 8px 0; }
.empty-subtitle { font-size: 12px; color: var(--color-text-tertiary); }
.inline-error { margin: 0; font-size: 12px; color: var(--color-error); }
@media (prefers-reduced-motion: reduce) {
  .fade-in { animation: none; opacity: 1; transform: none; }
  .friend-info, .follow-toggle { transition: none; }
  .friend-info:active, .follow-toggle:active { transform: none; }
}
</style>
