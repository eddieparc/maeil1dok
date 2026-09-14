<script setup lang="ts">
import { ref } from 'vue'
import { Check, ChevronDown, ChevronRight } from '@lucide/vue'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'

const notices = [
  {
    id: 'plan-update', date: '2025-03-01', dateLabel: '2025년 03월 01일', isNew: true,
    title: '푸른통독 지원',
    summary: '매일일독이 더욱 다양한 성경통독 플랜을 지원해요.\n이제 청년부 푸른통독도 매일일독에서 함께 관리할 수 있어요.',
    points: ['여러 플랜을 동시에 구독하고 진행할 수 있어요', '각 플랜별로 진도와 통계를 별도 관리해요', '교역자를 위한 총회 목회달력도 지원 예정이예요'],
    to: '/notice/plan-update', action: '자세히 보기',
  },
  {
    id: 'install', date: '2025-02-27', dateLabel: '2025년 02월 27일', isNew: false,
    title: '매일일독 앱 설치 안내', summary: '매일일독을 앱처럼 사용할 수 있는 방법을 알려드려요.',
    points: [], to: '/install', action: '설치 방법 보기',
  },
  {
    id: 'launch', date: '2025-02-24', dateLabel: '2025년 02월 24일', isNew: false,
    title: '매일일독 서비스 시작', summary: '매일일독 서비스가 출시되었어요.',
    body: '성경 통독을 더 편리하게 진행하실 수 있도록 최선을 다해 도와드릴게요.', points: [],
  },
]
const expanded = ref<Record<string, boolean>>({ 'plan-update': true })
</script>

<template>
  <PageLayout title="공지사항" fallback-path="/">
    <div class="notice-list">
      <ListCard v-for="notice in notices" :key="notice.id" :padded="false">
        <h2 class="notice-heading">
          <button
            :id="`notice-toggle-${notice.id}`"
            type="button"
            class="notice-toggle"
            :aria-expanded="!!expanded[notice.id]"
            :aria-controls="`notice-panel-${notice.id}`"
            @click="expanded[notice.id] = !expanded[notice.id]"
          >
            <span class="notice-meta">
              <span v-if="notice.isNew" class="notice-badge">NEW</span>
              <time :datetime="notice.date">{{ notice.dateLabel }}</time>
              <ChevronDown :size="18" class="notice-chevron" :class="{ 'is-expanded': expanded[notice.id] }" aria-hidden="true" />
            </span>
            <span class="notice-title">{{ notice.title }}</span>
            <span class="notice-summary">{{ notice.summary }}</span>
          </button>
        </h2>
        <div :id="`notice-panel-${notice.id}`" :hidden="!expanded[notice.id]" role="region" :aria-labelledby="`notice-toggle-${notice.id}`" class="notice-panel">
          <ul v-if="notice.points.length" class="notice-points">
            <li v-for="point in notice.points" :key="point"><Check :size="16" aria-hidden="true" /><span>{{ point }}</span></li>
          </ul>
          <p v-if="notice.body" class="notice-body">{{ notice.body }}</p>
          <AppButton v-if="notice.to" :to="notice.to" variant="secondary" size="sm">{{ notice.action }}<ChevronRight :size="16" aria-hidden="true" /></AppButton>
        </div>
      </ListCard>
    </div>
  </PageLayout>
</template>

<style scoped>
.notice-list { display: grid; gap: 14px; padding: 20px var(--screen-gutter) 32px; }
.notice-heading { margin: 0; font: inherit; }
.notice-toggle { box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: var(--hit-min); min-height: var(--hit-min); padding: 20px; border: 0; border-radius: var(--radius-card); background: transparent; color: var(--color-text-primary); text-align: left; font: inherit; cursor: pointer; transition: background-color var(--duration-micro) ease; }
.notice-toggle:hover { background: var(--color-bg-hover); }
.notice-toggle:active { background: var(--color-bg-tertiary); }
.notice-toggle:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
.notice-meta { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 12px; color: var(--color-text-tertiary); }
.notice-badge { padding: 2px 8px; border-radius: var(--radius-pill); background: var(--color-accent-primary); color: var(--color-text-inverse); font-size: 10px; font-weight: 700; }
.notice-chevron { margin-left: auto; flex-shrink: 0; transition: transform var(--duration-micro) ease; }
.notice-chevron.is-expanded { transform: rotate(180deg); }
.notice-title { font-size: 16px; font-weight: 700; line-height: 1.3; }
.notice-summary { white-space: pre-line; font-size: 13px; font-weight: 400; line-height: 1.55; color: var(--color-text-secondary); }
.notice-panel { padding: 0 20px 20px; }
.notice-points { display: grid; gap: 8px; padding: 12px 16px; margin: 0 0 12px; list-style: none; background: var(--color-bg-tertiary); border-radius: var(--radius-control); }
.notice-points li { display: flex; gap: 8px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
.notice-points svg { flex-shrink: 0; margin-top: 2px; color: var(--color-accent-primary); }
.notice-body { margin: 0; font-size: 14px; line-height: 1.75; color: var(--color-text-secondary); }
@media (min-width: 1024px) { .notice-list { padding-block: 32px 40px; } }
@media (prefers-reduced-motion: reduce) { .notice-toggle, .notice-chevron { transition: none; } }
</style>
