<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthService } from '~/composables/useAuthService';
import { useAuthGuard } from '~/composables/useAuthGuard';
import BibleScheduleContent from '~/components/BibleScheduleContent.vue';
import PageLayout from '~/components/common/PageLayout.vue';
import AppButton from '~/components/ui/AppButton.vue';

definePageMeta({ layout: 'default' });
const auth = useAuthService();
const { requireAuthWithPrompt } = useAuthGuard();
const isBulkEditMode = ref(false);
async function toggleBulkEditMode() {
  if (await requireAuthWithPrompt('읽음 표시를 기록하려면 로그인이 필요해요.')) isBulkEditMode.value = !isBulkEditMode.value;
}
watch(() => auth.user.value?.id, () => { isBulkEditMode.value = false; });
</script>

<template>
  <PageLayout title="성경통독표" class="plan-page">
    <template #header-action>
      <AppButton size="sm" :variant="isBulkEditMode ? 'primary' : 'secondary'" :disabled="!auth.isInitialized.value"
        :aria-pressed="auth.isAuthenticated.value ? isBulkEditMode : undefined" @click="toggleBulkEditMode">
        {{ auth.isAuthenticated.value ? (isBulkEditMode ? '완료' : '일괄수정') : '로그인' }}
      </AppButton>
    </template>
    <div class="scroll-area">
      <BibleScheduleContent :is-bulk-edit-mode="isBulkEditMode" :use-default-plan="false" initial-scroll-target="today" @range-select="isBulkEditMode = false" />
    </div>
  </PageLayout>
</template>

<style scoped>
.plan-page :deep(.page-layout-content) { height: 100dvh; }
.plan-page :deep(.scroll-area.with-floating-nav) { display: flex; flex-direction: column; overflow: hidden; }
.scroll-area { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
</style>
