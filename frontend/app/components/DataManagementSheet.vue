<template>
  <BottomSheet :model-value="modelValue" title="데이터 관리" class="data-management-sheet" @update:model-value="emit('update:modelValue', $event)">
    <template #header-extra>
      <AppButton class="done-btn" variant="ghost" size="sm" @click="closeSheet">완료</AppButton>
    </template>

    <nav class="quick-links" aria-label="성경 기록">
      <NuxtLink to="/bible/bookmarks">북마크</NuxtLink>
      <NuxtLink to="/bible/notes">노트</NuxtLink>
      <NuxtLink to="/bible/highlights">하이라이트</NuxtLink>
    </nav>

    <section class="settings-section danger-section">
      <h2 class="section-title">데이터 관리</h2>
      <p>아래 작업은 되돌릴 수 없습니다.</p>
      <div class="danger-buttons">
        <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllBookmarks">북마크 전체 삭제</AppButton>
        <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllNotes">노트 전체 삭제</AppButton>
        <AppButton variant="danger" :disabled="isDeleting" @click="deleteAllHighlights">하이라이트 전체 삭제</AppButton>
        <AppButton variant="danger" :disabled="isDeleting" @click="resetAllSettings">모든 설정 초기화</AppButton>
      </div>
    </section>
  </BottomSheet>
  <Toast />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useReadingSettingsStore } from '~/stores/readingSettings';
import { useAuthService } from '~/composables/useAuthService';
import { useApi } from '~/composables/useApi';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useToast } from '~/composables/useToast';
import BottomSheet from '~/components/ui/BottomSheet.vue';
import AppButton from '~/components/ui/AppButton.vue';
import Toast from '~/components/Toast.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const settingsStore = useReadingSettingsStore();
const auth = useAuthService();
const api = useApi();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();
const isDeleting = ref(false);
const closeSheet = () => emit('update:modelValue', false);

const deleteAllBookmarks = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '북마크 전체 삭제',
    description: '모든 북마크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/bookmarks/delete-all/');
    toast.success('북마크가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '북마크 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const deleteAllNotes = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '노트 전체 삭제',
    description: '모든 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/notes/delete-all/');
    toast.success('노트가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '노트 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const deleteAllHighlights = async () => {
  if (!auth.isAuthenticated.value) {
    toast.error('로그인이 필요합니다');
    return;
  }
  const confirmed = await modal.confirm({
    title: '하이라이트 전체 삭제',
    description: '모든 하이라이트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  isDeleting.value = true;
  try {
    await api.DELETE('/api/v1/todos/bible/highlights/delete-all/');
    toast.success('하이라이트가 모두 삭제되었습니다');
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  } finally {
    isDeleting.value = false;
  }
};

const resetAllSettings = async () => {
  const confirmed = await modal.confirm({
    title: '설정 초기화',
    description: '모든 설정을 기본값으로 초기화하시겠습니까?',
    confirmText: '초기화',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  settingsStore.resetToDefaults();
  toast.success('설정이 초기화되었습니다');
};
</script>

<style scoped>
:global(.data-management-sheet .bottom-sheet__handle) { width: 36px; }
:global(.data-management-sheet .bottom-sheet__close) { display: none; }
:global(.data-management-sheet) { border-radius: 24px 24px 0 0; }
.quick-links { display: flex; flex-wrap: wrap; gap: 16px; }
.quick-links a { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-accent-primary); }
.done-btn { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--color-accent-primary); }
.settings-section { margin-bottom: 20px; }
.section-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.danger-section { margin-top: 20px; }
.danger-section p { font-size: 12px; color: var(--color-error); }
.danger-buttons { display: grid; gap: 8px; }
</style>
