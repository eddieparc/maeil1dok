<template>
  <div class="header">
    <button v-if="showBack" class="back-button" aria-label="뒤로 가기" @click="handleBack">
      <ChevronLeftIcon :size="20" />
    </button>
    <div v-else class="back-placeholder"></div>

    <h1>{{ title }}</h1>

    <div class="right-slot">
      <slot name="right">
        <div class="right-placeholder"></div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ChevronLeftIcon from '~/components/icons/ChevronLeftIcon.vue';
import { useNavigation } from '~/composables/useNavigation';

interface Props {
  title: string;
  /** @deprecated Use fallbackPath instead. 명시적 경로 지정 (레거시 지원) */
  backPath?: string;
  /** 뒤로가기 불가 시 이동할 fallback 경로 */
  fallbackPath?: string;
  /** 뒤로가기 버튼 표시 여부 */
  showBack?: boolean;
  /** 커스텀 뒤로가기 핸들러 */
  onBack?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  backPath: undefined,
  fallbackPath: '/',
  showBack: true,
  onBack: undefined
});

const router = useRouter();
const { goBack } = useNavigation();

const handleBack = () => {
  // 커스텀 핸들러가 있으면 사용
  if (props.onBack) {
    props.onBack();
    return;
  }

  // 레거시: backPath가 명시적으로 지정된 경우 해당 경로로 이동
  if (props.backPath !== undefined) {
    router.push(props.backPath);
    return;
  }

  // 기본: 스마트 뒤로가기 (앱 내 히스토리 있으면 back, 없으면 fallback)
  goBack(props.fallbackPath);
};
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
  height: 50px;
  flex-shrink: 0;
}

.header h1 {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

.back-button {
  padding: 0.5rem;
  margin: -0.5rem;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.back-button:hover {
  background: var(--primary-light);
}

.back-placeholder {
  min-width: 32px;
}

.right-slot {
  min-width: 64px;
  display: flex;
  justify-content: flex-end;
}

.right-placeholder {
  min-width: 64px;
}

@media (max-width: 640px) {
  .header {
    padding: 0.75rem;
  }
}

</style>
