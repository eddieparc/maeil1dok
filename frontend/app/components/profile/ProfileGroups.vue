<template>
  <div class="profile-groups fade-in">
    <!-- 표시되는 그룹 목록 -->
    <div v-if="visibleGroups.length > 0" class="groups-list">
      <div
        v-for="group in visibleGroups"
        :key="group.id"
        class="group-item"
        role="link"
        tabindex="0"
        :aria-label="group.name"
        @keydown.enter.self="navigateToGroup(group.id)"
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
          role="link"
          tabindex="0"
          :aria-label="group.name"
          @keydown.enter.self="navigateToGroup(group.id)"
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
.profile-groups { padding: var(--card-padding); min-height: 300px; letter-spacing: var(--tracking-body); }
.groups-list { display: flex; flex-direction: column; gap: 10px; }
.group-item { padding: 18px 20px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); box-shadow: var(--shadow-card); cursor: pointer; transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.group-item:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
.group-item.hidden { border-style: dashed; }
.group-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.group-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--color-accent-primary-light); color: var(--color-accent-primary); flex-shrink: 0; }
.group-info { flex: 1; min-width: 0; }
.group-name { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: var(--color-text-primary); overflow-wrap: anywhere; }
.group-plan { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
.status-badge { display: inline-block; padding: 4px 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.group-description { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); }
.group-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 12px; border-top: 1px solid var(--color-border-light); }
.member-count { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
.group-actions { display: flex; align-items: center; gap: 8px; }
.group-role { padding: 4px 8px; font-size: 11px; font-weight: 600; color: var(--color-accent-primary); background: var(--color-accent-primary-light); border-radius: var(--radius-pill); }
.visibility-toggle { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
.visibility-toggle.show-btn { background: var(--color-accent-primary-light); color: var(--color-accent-primary); }
.visibility-toggle span { font-size: 12px; }
.hidden-groups-section { margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--color-border-default); }
.hidden-groups-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-tertiary); color: var(--color-text-secondary); font-size: 13px; cursor: pointer; }
.hidden-groups { margin-top: 12px; }
.empty-icon { color: var(--color-text-tertiary); }
button { min-width: var(--hit-min); min-height: var(--hit-min); transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
button:hover { background: var(--color-bg-hover); }
button:active,
.group-item:active { transform: scale(0.97); }
button:focus-visible,
.group-item:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
@media (max-width: 640px) {
  .group-header { flex-wrap: wrap; }
  .status-badge { margin-left: auto; }
  .group-actions { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  button,
  .group-item { transition: none; }
  button:active,
  .group-item:hover,
  .group-item:active { transform: none; }
}
</style>
