<template>
  <div class="profile-groups fade-in">
    <!-- 표시되는 그룹 목록 -->
    <div v-if="visibleGroups.length > 0" class="groups-list">
      <div
        v-for="group in visibleGroups"
        :key="group.id"
        class="group-item"
        @click="navigateToGroup(group.id)"
      >
        <div class="group-header">
          <div class="group-icon">
            <UsersIcon :size="20" />
          </div>
          <div class="group-info">
            <h4 class="group-name">{{ group.name }}</h4>
            <p class="group-plan">{{ getPlanName(group) }}</p>
          </div>
          <span
            :class="[
              'status-badge',
              group.is_public ? 'status-public' : 'status-private'
            ]"
          >
            {{ group.is_public ? '공개' : '비공개' }}
          </span>
        </div>

        <p v-if="group.description" class="group-description">
          {{ group.description }}
        </p>

        <div class="group-footer">
          <div class="member-count">
            <UserRoundPlusIcon :size="14" />
            <span>{{ group.member_count }}/{{ group.max_members }}명</span>
          </div>
          <div class="group-actions">
            <span class="group-role">
              {{ getRoleDisplay(group.my_role) }}
            </span>
            <!-- 본인 프로필인 경우 숨기기 토글 표시 -->
            <button
              v-if="isOwnProfile"
              class="visibility-toggle"
              :title="group.show_in_profile !== false ? '프로필에서 숨기기' : '프로필에 표시하기'"
              @click.stop="toggleVisibility(group)"
            >
              <EyeIcon v-if="group.show_in_profile !== false" :size="16" />
              <EyeOffIcon v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 숨겨진 그룹 섹션 (본인 프로필에서만 표시) -->
    <div v-if="isOwnProfile && hiddenGroups.length > 0" class="hidden-groups-section">
      <button class="hidden-groups-toggle" @click="showHiddenGroups = !showHiddenGroups">
        <span>프로필에 숨겨진 그룹 ({{ hiddenGroups.length }})</span>
        <ChevronUpIcon v-if="showHiddenGroups" :size="16" />
        <ChevronDownIcon v-else :size="16" />
      </button>

      <div v-if="showHiddenGroups" class="groups-list hidden-groups">
        <div
          v-for="group in hiddenGroups"
          :key="group.id"
          class="group-item hidden"
          @click="navigateToGroup(group.id)"
        >
          <div class="group-header">
            <div class="group-icon">
              <UsersIcon :size="20" />
            </div>
            <div class="group-info">
              <h4 class="group-name">{{ group.name }}</h4>
              <p class="group-plan">{{ getPlanName(group) }}</p>
            </div>
            <span class="status-badge status-hidden">숨김</span>
          </div>

          <div class="group-footer">
            <div class="member-count">
              <UserRoundPlusIcon :size="14" />
              <span>{{ group.member_count }}/{{ group.max_members }}명</span>
            </div>
            <button
              class="visibility-toggle show-btn"
              title="프로필에 표시하기"
            @click.stop="toggleVisibility(group)"
          >
              <EyeIcon :size="14" />
              <span>표시하기</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 빈 상태 -->
    <EmptyState
      v-if="groups.length === 0"
      title="가입된 그룹이 없습니다"
      description="다른 사용자들과 함께 성경을 읽어보세요!"
      action-text="그룹 둘러보기"
      @action="navigateToGroups"
    >
      <template #icon>
        <UsersIcon class="empty-icon" :size="48" />
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import EmptyState from '../common/EmptyState.vue'
import { useGroupsStore } from '~/stores/groups'
import { useToast } from '~/composables/useToast'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  UserRoundPlusIcon,
  UsersIcon,
} from '@lucide/vue'

interface BibleReadingPlan {
  id: number
  name: string
}

interface Group {
  id: number
  name: string
  description: string
  plans: BibleReadingPlan[]
  is_public: boolean
  member_count: number
  max_members: number
  my_role?: string
  show_in_profile?: boolean
}

const props = defineProps<{
  groupsData: Group[]
  isOwnProfile?: boolean
}>()

const groupsStore = useGroupsStore()
const toast = useToast()
const showHiddenGroups = ref(false)

// 실제 API 데이터만 사용 (Mock 데이터 제거)
const groups = computed(() => props.groupsData)

// 표시되는 그룹 (show_in_profile이 true이거나 undefined인 경우)
const visibleGroups = computed(() =>
  groups.value.filter(g => g.show_in_profile !== false)
)

// 숨겨진 그룹 (show_in_profile이 명시적으로 false인 경우)
const hiddenGroups = computed(() =>
  groups.value.filter(g => g.show_in_profile === false)
)

// 플랜 이름 가져오기 (plans 배열의 첫 번째 항목)
const getPlanName = (group: Group) => {
  if (group.plans && group.plans.length > 0) {
    const planNames = group.plans.map(p => p.name)
    return planNames.length > 1
      ? `${planNames[0]} 외 ${planNames.length - 1}개`
      : planNames[0]
  }
  return '계획 없음'
}

// 역할 표시 (my_role 매핑)
const getRoleDisplay = (role?: string) => {
  if (!role) return '멤버'
  // API에서 '관리자', '멤버'로 내려옴
  return role === '관리자' ? '그룹장' : '멤버'
}

// 그룹 표시 여부 토글
const toggleVisibility = async (group: Group) => {
  const newValue = group.show_in_profile === false
  const result = await groupsStore.updateGroupVisibility(group.id, newValue)

  if (result.success) {
    toast.success(newValue ? '프로필에 표시됩니다' : '프로필에서 숨겨집니다')
  } else {
    toast.error('설정 변경에 실패했습니다')
  }
}

const navigateToGroup = (groupId: number) => {
  navigateTo(`/groups/${groupId}`)
}

const navigateToGroups = () => {
  navigateTo('/groups')
}
</script>

<style scoped>
.profile-groups {
  padding: 1rem;
  min-height: 300px;
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-item {
  background: white;
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition: all var(--transition-normal);
}

:root.dark .group-item {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

.group-item:hover {
  border-color: var(--primary-color);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.group-item.hidden {
  opacity: 0.7;
  border-style: dashed;
}

.group-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary-color);
  flex-shrink: 0;
}

:root.dark .group-icon {
  background: var(--color-bg-tertiary);
}

.group-icon i {
  font-size: 1rem;
}

.group-info {
  flex: 1;
  min-width: 0;
}

.group-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-plan {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  flex-shrink: 0;
}

.status-public {
  background: #D1FAE5;
  color: #065F46;
}

:root.dark .status-public {
  background: rgba(42, 17, 17, 0.2);
  color: #3A1A1A;
}

.status-private {
  background: var(--gray-100);
  color: var(--gray-700);
}

:root.dark .status-private {
  background: var(--color-bg-tertiary);
  color: var(--text-secondary);
}

.status-hidden {
  background: #FEF3C7;
  color: #92400E;
}

:root.dark .status-hidden {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.group-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.group-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--gray-200);
}

:root.dark .group-footer {
  border-color: var(--color-border);
}

.member-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.member-count i {
  font-size: 0.875rem;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.group-role {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--primary-color);
  background: var(--primary-light);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
}

:root.dark .group-role {
  background: var(--color-bg-tertiary);
}

.visibility-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

:root.dark .visibility-toggle {
  border-color: var(--color-border);
}

.visibility-toggle:hover {
  background: var(--gray-100);
  border-color: var(--gray-400);
}

:root.dark .visibility-toggle:hover {
  background: var(--color-bg-hover);
}

.visibility-toggle.show-btn {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

:root.dark .visibility-toggle.show-btn {
  background: var(--color-bg-tertiary);
}

.visibility-toggle.show-btn:hover {
  background: var(--primary-color);
  color: white;
}

.visibility-toggle i {
  font-size: 0.875rem;
}

.visibility-toggle span {
  font-size: 0.75rem;
}

/* 숨겨진 그룹 섹션 */
.hidden-groups-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--gray-300);
}

:root.dark .hidden-groups-section {
  border-color: var(--color-border);
}

.hidden-groups-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

:root.dark .hidden-groups-toggle {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

.hidden-groups-toggle:hover {
  background: var(--gray-100);
}

:root.dark .hidden-groups-toggle:hover {
  background: var(--color-bg-hover);
}

.hidden-groups {
  margin-top: 1rem;
}

.empty-icon {
  font-size: 3rem;
  color: var(--gray-300);
}

:root.dark .empty-icon {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .group-item {
    padding: 1rem;
  }

  .group-header {
    flex-wrap: wrap;
  }

  .status-badge {
    order: 3;
    margin-left: auto;
  }

  .group-actions {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
