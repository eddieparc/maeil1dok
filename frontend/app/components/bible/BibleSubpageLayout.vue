<template>
  <div class="bible-page bible-subpage">
    <header class="bible-page-header">
      <button class="bible-back-btn" @click="handleBack">
        <ChevronLeftIcon :size="20" />
      </button>
      <h1>{{ title }}</h1>
      <div class="bible-header-actions">
        <slot name="actions" />
      </div>
    </header>

    <!-- 필터 슬롯 -->
    <slot name="filter" />

    <!-- 로딩 상태 -->
    <template v-if="loading">
      <slot name="skeleton">
        <LoadingSpinner :text="loadingText" />
      </slot>
    </template>

    <!-- 빈 상태 -->
    <EmptyState v-else-if="empty" :text="emptyText" :hint="emptyHint" :guide="emptyGuide">
      <template #icon>
        <slot name="empty-icon">
          <InfoCircleIcon :size="48" />
        </slot>
      </template>
      <template #guide>
        <slot name="empty-guide" />
      </template>
      <template #action>
        <slot name="empty-action" />
      </template>
    </EmptyState>

    <!-- 컨텐츠 -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ChevronLeftIcon from '~/components/icons/ChevronLeftIcon.vue';
import LoadingSpinner from '~/components/common/LoadingSpinner.vue';
import EmptyState from '~/components/common/EmptyState.vue';
import InfoCircleIcon from '~/components/icons/InfoCircleIcon.vue';

interface Props {
  title: string;
  loading?: boolean;
  loadingText?: string;
  empty?: boolean;
  emptyText?: string;
  emptyHint?: string;
  emptyGuide?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingText: '불러오는 중...',
  empty: false,
  emptyText: '데이터가 없습니다',
  emptyHint: '',
  emptyGuide: undefined,
});

const router = useRouter();

const handleBack = () => {
  router.back();
};
</script>

<style scoped>
/*
 * BibleSubpageLayout specific styles
 * 공통 스타일은 bible-page.css에서 관리됨
 */

/* 레이아웃 래퍼 - 전역 .bible-page에 추가 스타일 */
.bible-subpage {
  display: flex;
  flex-direction: column;
}

/* 로딩/빈 상태가 flex: 1을 차지하도록 */
.bible-subpage :deep(.loading-spinner-container),
.bible-subpage :deep(.empty-state-container) {
  flex: 1;
  min-height: auto;
}
</style>
