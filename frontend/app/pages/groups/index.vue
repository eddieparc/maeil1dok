<template>
  <PageLayout title="함께" :show-back-button="false" class="groups-page">
    <template #header-action>
      <div class="header-links">
        <AppButton to="/friends" variant="secondary" size="sm">친구</AppButton>
        <AppButton to="/scoreboard" variant="secondary" size="sm">리더보드</AppButton>
      </div>
    </template>

    <div class="content-wrapper">
      <div class="filter-section fade-in">
        <div class="search-row">
          <div class="search-container">
            <Search class="search-icon" :size="18" aria-hidden="true" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="그룹 이름으로 검색"
              aria-label="그룹 이름으로 검색"
              class="search-input"
              @input="debouncedSearch"
            >
          </div>
          <button class="create-button press" type="button" aria-label="그룹 생성" @click="handleCreateGroup">
            <Plus :size="22" aria-hidden="true" />
          </button>
        </div>
        <div class="filter-tabs" aria-label="그룹 필터">
          <FilterChip
            v-for="filter in filters"
            :key="filter.value"
            :label="filter.label"
            :active="activeFilter === filter.value"
            @click="activeFilter = filter.value"
          />
        </div>
      </div>

      <div v-if="showInitialSkeleton" class="groups-grid" role="status" aria-label="그룹을 불러오는 중" aria-busy="true">
        <ListCard v-for="i in 4" :key="i" class="group-skeleton">
          <Skeleton width="72px" height="20px" />
          <Skeleton width="65%" height="22px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="45%" height="24px" />
        </ListCard>
      </div>
      <div v-else-if="groupsStore.error" class="load-error" role="alert">
        <p>{{ groupsStore.error }}</p>
        <AppButton variant="secondary" @click="loadGroups">다시 시도</AppButton>
      </div>
      <div v-else-if="currentGroups.length > 0" class="groups-grid stagger">
        <GroupCard
          v-for="(group, index) in currentGroups"
          :key="group.id"
          :group="group"
          :is-authenticated="isAuthenticated"
          class="fade-in"
          :style="{ animationDelay: `${80 + index * 50}ms` }"
          @join="joinGroup"
        />
      </div>
      <EmptyState
        v-else
        :title="searchQuery ? '검색 결과가 없습니다' : '아직 그룹이 없습니다'"
        :description="searchQuery ? '다른 검색어로 시도해보세요.' : '다른 사용자들과 함께 성경을 읽어보세요!'"
        :action-text="isAuthenticated && !searchQuery ? '첫 그룹 만들기' : ''"
        @action="showCreateModal = true"
      >
        <template #icon><Users :size="64" :stroke-width="1.5" aria-hidden="true" /></template>
      </EmptyState>
    </div>
    <CreateGroupModal v-if="showCreateModal" @close="showCreateModal = false" @created="onGroupCreated" />
  </PageLayout>
</template>

<script setup lang="ts">
import { Plus, Search, Users } from '@lucide/vue'
import { debounce } from 'lodash-es'
import { useGroupsStore } from '~/stores/groups'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import PageLayout from '~/components/common/PageLayout.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import AppButton from '~/components/ui/AppButton.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import ListCard from '~/components/ui/ListCard.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import GroupCard from '~/components/groups/GroupCard.vue'

const groupsStore = useGroupsStore()
const auth = useAuthService()
const modal = useModal()
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const isLoading = computed(() => groupsStore.isLoading)
const isInitialPending = ref(true)
const showInitialSkeleton = computed(() =>
  (isInitialPending.value || isLoading.value) && currentGroups.value.length === 0
)
const searchQuery = ref('')
const activeFilter = ref<'all' | 'public' | 'mine'>('all')
const showCreateModal = ref(false)
const filters = [
  { value: 'all', label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'mine', label: '내 그룹' }
] as const

const currentGroups = computed(() => {
  if (activeFilter.value === 'mine') return groupsStore.myGroups
  if (activeFilter.value === 'public') return groupsStore.publicGroups
  return groupsStore.groups
})

const loadGroups = async () => {
  try {
    await groupsStore.fetchGroups({
      search: searchQuery.value,
      ...(activeFilter.value === 'public' ? { only_public: true } : {}),
      ...(activeFilter.value === 'mine' ? { only_mine: true } : {})
    })
  } finally {
    isInitialPending.value = false
  }
}
const debouncedSearch = debounce(loadGroups, 300)
watch(activeFilter, () => {
  debouncedSearch.cancel()
  loadGroups()
})
onMounted(loadGroups)

const handleCreateGroup = () => {
  if (!isAuthenticated.value) return navigateTo('/login')
  showCreateModal.value = true
}
const joinGroup = async (groupId: number) => {
  const result = await groupsStore.joinGroup(groupId)
  if (result.success) {
    loadGroups()
  } else {
    await modal.alert({ title: '가입 실패', description: result.error || '그룹 가입에 실패했습니다.', icon: 'error' })
  }
}
const onGroupCreated = (group: { id: number }) => {
  showCreateModal.value = false
  navigateTo(`/groups/${group.id}`)
}
onUnmounted(() => {
  debouncedSearch.cancel()
  groupsStore.clearGroupData()
})
</script>

<style scoped>
.groups-page :deep(.header) { height: 64px; padding: 6px 20px; background: var(--color-bg-primary); border-bottom: none; gap: 8px; }
.groups-page :deep(.back-placeholder) { display: none; }
.groups-page :deep(.header h1) { font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: -0.6px; }
.header-links { display: flex; gap: 6px; }
.header-links :deep(.app-button) { padding-inline: 12px; }
.content-wrapper { padding: 14px 20px 20px; max-width: 768px; margin: 0 auto; letter-spacing: var(--tracking-body); }
.filter-section { display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px; }
.search-row { display: flex; align-items: center; gap: 10px; }
.search-container { position: relative; flex: 1; min-width: 0; }
.search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary); pointer-events: none; }
.search-input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 16px 0 44px; border: 1px solid var(--color-border-default); border-radius: 999px; background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; font-size: 14px; transition: border-color var(--duration-micro) ease; }
.search-input::placeholder { color: var(--color-text-tertiary); }
.search-input:focus-visible { outline: none; border-color: var(--color-accent-primary); box-shadow: 0 0 0 3px var(--color-accent-focus-ring); }
.create-button { display: flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; padding: 0; border: 1px solid var(--color-accent-primary); border-radius: 50%; background: var(--color-accent-primary); color: var(--color-text-inverse); cursor: pointer; }
.create-button:hover { background: var(--color-accent-primary-hover); }
.filter-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.groups-grid { display: flex; flex-direction: column; gap: 10px; }
.groups-grid :deep(.avatar-stack) { display: flex; align-items: center; padding-left: 8px; }
.groups-grid :deep(.avatar-stack > *) { margin-left: -8px; }
.group-skeleton :deep(.list-card__content) { display: flex; flex-direction: column; gap: 12px; }
.load-error { text-align: center; color: var(--color-text-secondary); padding: 20px; }
@media (prefers-reduced-motion: reduce) { .search-input { transition: none; } }
</style>
