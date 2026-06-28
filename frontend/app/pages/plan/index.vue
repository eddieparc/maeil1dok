<template>
  <PageLayout title="성경통독표">
    <template #header-action>
      <ClientOnly>
        <button
          v-if="authStore.isAuthenticated"
          class="edit-mode-button"
          :class="{ active: isBulkEditMode }"
          @click="toggleBulkEditMode"
        >
          {{ isBulkEditMode ? '완료' : '일괄수정' }}
        </button>
        <button v-else class="edit-mode-button" @click="goToLogin">
          로그인
        </button>
        <template #fallback>
          <button class="edit-mode-button" disabled>...</button>
        </template>
      </ClientOnly>
    </template>

    <!-- 스크롤 영역 -->
    <div class="scroll-area">
      <BibleScheduleContent
        :is-bulk-edit-mode="isBulkEditMode"
        :use-default-plan="false"
        initial-scroll-target="today"
        @range-select="handleRangeSelect"
      />
    </div>

    <Toast />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import { useScheduleApi } from '~/composables/useScheduleApi';
import { useToast } from '~/composables/useToast';
import BibleScheduleContent from '~/components/BibleScheduleContent.vue';
import PageLayout from '~/components/common/PageLayout.vue';
import Toast from '~/components/Toast.vue';
import type { RangeSelectPayload } from '~/types/plan';

definePageMeta({
  layout: 'default',
});

const authStore = useAuthService();
const router = useRouter();
const route = useRoute();
const scheduleApi = useScheduleApi();
const toast = useToast();

const isBulkEditMode = ref(false);

function toggleBulkEditMode() {
  isBulkEditMode.value = !isBulkEditMode.value;
}

function goToLogin() {
  router.push('/login?redirect=' + encodeURIComponent(route.fullPath));
}

async function handleRangeSelect({ action, scheduleIds, planId }: RangeSelectPayload) {
  if (!planId) return;

  const success = await scheduleApi.updateBulkReadingStatus(planId, scheduleIds, action);

  if (success) {
    isBulkEditMode.value = false;
  }
}
</script>

<style scoped>
.scroll-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* iOS 안전영역 대응 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .scroll-area {
    padding-bottom: env(safe-area-inset-bottom);
  }
}

.edit-mode-button {
  padding: 0.25rem 0.75rem;
  background: var(--color-slate-100);
  color: var(--color-slate-500);
  border: 1px solid var(--color-slate-300);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.edit-mode-button:hover {
  background: var(--color-slate-200);
  color: var(--color-slate-600);
}

.edit-mode-button:active,
.edit-mode-button.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

/* Dark Mode Overrides */
[data-theme="dark"] .edit-mode-button {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: var(--color-border-default);
}

[data-theme="dark"] .edit-mode-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
}

[data-theme="dark"] .edit-mode-button:active,
[data-theme="dark"] .edit-mode-button.active {
  background: var(--color-accent-primary);
  color: #ffffff;
  border-color: var(--color-accent-primary);
  font-weight: 600;
}
</style>
