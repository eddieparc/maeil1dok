<template>
  <NuxtLink :to="`/groups/${group.id}`" class="group-card">
    <div class="header-top">
      <div class="badges">
        <span class="status-badge">{{ group.is_public ? '공개' : '비공개' }}</span>
        <span v-if="group.is_member" class="status-badge my-group">내 그룹</span>
      </div>
      <span class="member-count">{{ group.member_count }}/{{ group.max_members }}명</span>
    </div>
    <h2 class="group-name">{{ group.name }}</h2>
    <p class="group-description">{{ group.description || '설명이 없습니다.' }}</p>
    <div class="group-footer">
      <span class="plan-name">
        {{ group.plans?.[0]?.name || '등록된 읽기표 없음' }}
        <template v-if="group.plans?.length > 1"> 외 {{ group.plans.length - 1 }}개</template>
      </span>
      <!-- TODO(handoff-v2): 목록 API가 제공하는 실제 인물은 리더뿐이며 나머지는 인원수로 표시한다. -->
      <div class="avatar-stack" :aria-label="`${group.creator?.nickname || '리더'} 외 그룹 멤버 ${Math.max(0, group.member_count - 1)}명`">
        <NuxtImg v-if="group.creator?.profile_image" :src="group.creator.profile_image" alt="" class="stack-avatar" loading="lazy" />
        <span v-else class="stack-avatar" aria-hidden="true">{{ group.creator?.nickname?.charAt(0) || '?' }}</span>
        <span v-if="group.member_count > 1" class="stack-avatar stack-count" aria-hidden="true">+{{ group.member_count - 1 }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  group: { type: Object, required: true },
  isAuthenticated: { type: Boolean, default: false }
})
defineEmits(['join'])
</script>

<style scoped>
.group-card { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border: 1px solid var(--color-border-default); border-radius: 20px; background: var(--color-bg-card); box-shadow: var(--shadow-card); color: var(--color-text-primary); text-decoration: none; letter-spacing: var(--tracking-body); transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.group-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.group-card:active { transform: scale(0.97); }
.group-card:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.header-top, .group-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.badges { display: flex; gap: 6px; }
.status-badge { padding: 4px 8px; border-radius: 999px; background: var(--color-bg-tertiary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; line-height: 1; }
.my-group { background: var(--color-accent-primary-light); color: var(--color-accent-primary); }
.member-count { font-size: 12px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.group-name { margin: 2px 0 0; font-size: 17px; font-weight: 700; line-height: 1.3; }
.group-description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
.group-footer { margin-top: 4px; }
.plan-name { min-width: 0; color: var(--color-text-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar-stack { display: flex; align-items: center; flex-shrink: 0; padding-left: 8px; }
.stack-avatar { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 24px; height: 24px; margin-left: -8px; border: 2px solid var(--color-bg-card); border-radius: 50%; object-fit: cover; background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 10px; font-weight: 700; }
.stack-count { width: auto; min-width: 24px; padding: 0 3px; background: var(--color-bg-tertiary); color: var(--color-text-secondary); font-size: 9px; }
[data-theme="dark"] .my-group { background: transparent; outline: 1.5px solid var(--color-accent-primary); }
@media (prefers-reduced-motion: reduce) { .group-card { transition: none; } .group-card:hover, .group-card:active { transform: none; } }
</style>
