<template>
  <PageLayout title="그룹">
    <template #header-action>
      <button
        v-if="isAuthenticated"
        @click="showCreateModal = true"
        class="header-create-button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </template>

    <div class="content-wrapper">
      <!-- 검색 및 필터 섹션 -->
      <div class="filter-section fade-in">
        <div class="search-container">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="그룹 이름으로 검색해보세요"
            class="search-input"
            @input="debouncedSearch"
          >
        </div>

        <div class="filter-tabs">
          <button
            v-for="filter in filters"
            :key="filter.value"
            @click="activeFilter = filter.value"
            :class="['filter-tab', { active: activeFilter === filter.value }]"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <!-- 로딩 상태 -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonGroupCard v-for="i in 4" :key="i" />
      </div>

      <!-- 그룹 목록 -->
      <div v-else-if="currentGroups.length > 0" class="groups-grid fade-in delay-100">
        <GroupCard
          v-for="group in currentGroups"
          :key="group.id"
          :group="group"
          :is-authenticated="isAuthenticated"
          @join="joinGroup"
        />
      </div>

      <!-- 빈 상태 -->
      <EmptyState
        v-else
        :title="searchQuery ? '검색 결과가 없습니다' : '아직 그룹이 없습니다'"
        :description="searchQuery ? '다른 검색어로 시도해보세요.' : '다른 사용자들과 함께 성경을 읽어보세요!'"
        :action-text="isAuthenticated && !searchQuery ? '첫 그룹 만들기' : ''"
        @action="showCreateModal = true"
      >
        <template #icon>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </template>
      </EmptyState>
    </div>

    <!-- 그룹 생성 모달 -->
    <CreateGroupModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onGroupCreated"
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { useGroupsStore } from '~/stores/groups'
import { useAuthService } from '~/composables/useAuthService'
import { debounce } from 'lodash-es'
import PageLayout from '~/components/common/PageLayout.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import SkeletonGroupCard from '~/components/ui/skeleton/SkeletonGroupCard.vue'
import GroupCard from '~/components/groups/GroupCard.vue'
import { useModal } from '~/composables/useModal'

const groupsStore = useGroupsStore()
const auth = useAuthService()
const modal = useModal()

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const isLoading = computed(() => groupsStore.isLoading)

const searchQuery = ref('')
const activeFilter = ref<'all' | 'public' | 'mine'>('all')
const showCreateModal = ref(false)

const filters = [
  { value: 'all', label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'mine', label: '내 그룹' }
]

const currentGroups = computed(() => {
  if (activeFilter.value === 'mine') {
    return groupsStore.myGroups
  } else if (activeFilter.value === 'public') {
    return groupsStore.publicGroups
  }
  return groupsStore.groups
})

// 초기 데이터 로드
onMounted(() => {
  loadGroups()
})

// 그룹 로드
const loadGroups = () => {
  const filters: any = { search: searchQuery.value }

  if (activeFilter.value === 'public') {
    filters.only_public = true
  } else if (activeFilter.value === 'mine') {
    filters.only_mine = true
  }

  groupsStore.fetchGroups(filters)
}

// 검색 디바운스
const debouncedSearch = debounce(() => {
  loadGroups()
}, 300)

// 필터 변경 감시
watch(activeFilter, () => {
  loadGroups()
})

// 그룹 가입
const joinGroup = async (groupId: number) => {
  const result = await groupsStore.joinGroup(groupId)
  if (result.success) {
    // 그룹 목록 새로고침
    loadGroups()
  } else {
    await modal.alert({
      title: '가입 실패',
      description: result.error || '그룹 가입에 실패했습니다.',
      icon: 'error'
    })
  }
}

// 그룹 생성 완료
const onGroupCreated = (group: any) => {
  showCreateModal.value = false
  navigateTo(`/groups/${group.id}`)
}

// 페이지 떠날 때 정리
onUnmounted(() => {
  groupsStore.clearGroupData()
})
</script>

<style scoped>
.content-wrapper {
  padding: 1rem;
  max-width: 768px;
  margin: 0 auto;
}

.header-create-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  margin: -0.5rem;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-create-button:hover {
  background: var(--primary-light);
}

.filter-section {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-container {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94A3B8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  font-size: 0.9375rem;
  color: #1E293B;
  background: white;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

.search-input:focus {
  outline: none;
  border-color: #94A3B8;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.1);
}

.search-input::placeholder {
  color: #CBD5E1;
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem; /* Scrollbar spacing */
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.filter-tab {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748B;
  background: #F8FAFC;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-family: 'Pretendard', sans-serif;
}

.filter-tab:hover {
  background: #F1F5F9;
  color: #475569;
}

.filter-tab.active {
  background: #1E293B;
  color: white;
  border-color: #1E293B;
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Dark Mode Overrides */
[data-theme="dark"] .search-input {
  background: var(--color-bg-tertiary);
  border-color: transparent;
  color: var(--color-text-primary);
}

[data-theme="dark"] .search-input:focus {
  background: var(--color-bg-secondary);
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px rgba(42, 17, 17, 0.15);
}

[data-theme="dark"] .search-input::placeholder {
  color: var(--color-text-muted);
}

[data-theme="dark"] .filter-tab {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-color: transparent;
}

[data-theme="dark"] .filter-tab:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .filter-tab.active {
  background: var(--color-accent-primary);
  color: #ffffff;
  border-color: transparent;
  font-weight: 600;
}

[data-theme="dark"] .header-create-button:hover {
  background: var(--color-bg-hover);
}
</style>
