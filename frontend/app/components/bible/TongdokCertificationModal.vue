<template>
  <BaseModal
    :model-value="modelValue"
    title="통독 인증 카드"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div class="certification-modal">
      <TongdokCertificationCard :certification="certification" />

      <p v-if="isLoading" class="certification-status" role="status">
        인증 정보를 불러오고 있습니다.
      </p>

      <div class="certification-actions" aria-label="통독 인증 카드 공유 작업">
        <button class="certification-action primary" type="button" :disabled="isCertificationActionDisabled" @click="handleShare">
          <ShareIcon :size="18" :stroke-width="2" aria-hidden="true" />
          <span>공유하기</span>
        </button>
        <button class="certification-action" type="button" :disabled="isCertificationActionDisabled" @click="handleDownload">
          <DownloadIcon :size="18" :stroke-width="2" aria-hidden="true" />
          <span>이미지 저장</span>
        </button>
        <button class="certification-action" type="button" :disabled="isActionBusy" @click="handleCopy">
          <LinkIcon :size="18" :stroke-width="2" aria-hidden="true" />
          <span>링크 복사</span>
        </button>
      </div>

      <p v-if="statusMessage" class="certification-status" role="status">
        {{ statusMessage }}
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { DownloadIcon, LinkIcon, ShareIcon } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import BaseModal from '~/components/ui/modal/BaseModal.vue';
import TongdokCertificationCard from '~/components/bible/TongdokCertificationCard.vue';
import { useApi } from '~/composables/useApi';
import {
  useCertificationShare,
  type CertificationProgressPayload,
  type CertificationSharePayload,
} from '~/composables/useCertificationShare';
import type { components } from '~/types/generated/api-schema';

type CertificationStatus = NonNullable<CertificationProgressPayload['progress']>['status'];

const CERTIFICATION_STATUSES = new Set<string>([
  'no_progress',
  'in_progress',
  'completed',
] satisfies CertificationStatus[]);

const toCertificationPayload = (
  response: components['schemas']['CertificationProgressResponse']
): CertificationProgressPayload | null =>
  CERTIFICATION_STATUSES.has(response.progress.status)
    ? {
        ...response,
        progress: {
          ...response.progress,
          status: response.progress.status as CertificationStatus,
        },
      }
    : null;

const props = defineProps<{
  modelValue: boolean;
  planId?: number | null;
  scheduleId?: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const { shareCertification, downloadCertificationImage, copyCertificationLink } = useCertificationShare();
const api = useApi();
const certification = ref<CertificationProgressPayload | null>(null);
const isLoading = ref(false);
const isBusy = ref(false);
const statusMessage = ref('');
const isActionBusy = computed(() => isBusy.value || isLoading.value);
const hasCertification = computed(() => Boolean(certification.value?.success));
const isCertificationActionDisabled = computed(() => isActionBusy.value || !hasCertification.value);

const sharePayload = computed<CertificationSharePayload>(() => {
  const progress = certification.value?.progress;
  return {
    title: certification.value?.card?.title,
    subtitle: certification.value?.card?.subtitle,
    readingRange: certification.value?.card?.readingRange,
    dateLabel: certification.value?.card?.dateLabel,
    footer: certification.value?.card?.footer,
    planName: certification.value?.plan?.name,
    planId: props.planId,
    scheduleId: props.scheduleId,
    progressLine: progress && progress.totalSchedules > 0
      ? `${progress.completedSchedules}/${progress.totalSchedules}일 완료 · ${progress.completionRate}%`
      : undefined,
  };
});

const fetchCertification = async (): Promise<void> => {
  if (!props.modelValue) return;

  isLoading.value = true;
  statusMessage.value = '';
  try {
    const response = await api.GET('/api/v1/todos/certification/progress/', {
      params: {
        plan_id: props.planId ?? undefined,
        schedule_id: props.scheduleId ?? undefined,
      },
    });
    certification.value = response.data.success ? toCertificationPayload(response.data) : null;
  } catch (error) {
    if (error instanceof Error) {
      certification.value = null;
      statusMessage.value = '인증 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
      return;
    }
    throw error;
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => [props.modelValue, props.planId, props.scheduleId] as const,
  ([isOpen]) => {
    if (!isOpen) {
      statusMessage.value = '';
      return;
    }
    void fetchCertification();
  },
  { immediate: true },
);

const runAction = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
  isBusy.value = true;
  statusMessage.value = '';
  try {
    await action();
    statusMessage.value = successMessage;
  } catch (error) {
    if (error instanceof Error) {
      statusMessage.value = '작업을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
      return;
    }
    throw error;
  } finally {
    isBusy.value = false;
  }
};

const handleShare = async (): Promise<void> => {
  if (!hasCertification.value) {
    statusMessage.value = '인증 정보를 불러온 후 공유할 수 있습니다.';
    return;
  }
  await runAction(async () => {
    await shareCertification(sharePayload.value);
  }, '인증 카드를 준비했습니다.');
};

const handleDownload = async (): Promise<void> => {
  if (!hasCertification.value) {
    statusMessage.value = '인증 정보를 불러온 후 이미지를 저장할 수 있습니다.';
    return;
  }
  await runAction(async () => {
    await downloadCertificationImage(undefined, sharePayload.value);
  }, '이미지를 저장했습니다.');
};

const handleCopy = async (): Promise<void> => {
  await runAction(async () => {
    const url = new URL('/bible/history', window.location.origin);
    if (props.planId) url.searchParams.set('plan_id', props.planId.toString());
    if (props.scheduleId) url.searchParams.set('schedule_id', props.scheduleId.toString());
    if (certification.value?.card?.dateLabel) url.searchParams.set('date', certification.value.card.dateLabel);
    url.searchParams.set('certification', 'tongdok');
    await copyCertificationLink(url.toString());
  }, '링크가 복사되었습니다.');
};
</script>

<style scoped>
.certification-modal {
  display: grid;
  gap: var(--spacing-4, 1rem);
  padding: var(--spacing-2, 0.5rem) 0 0;
}

.certification-actions {
  display: grid;
  gap: var(--spacing-2, 0.5rem);
}

.certification-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2, 0.5rem);
  padding: 0.75rem 1rem;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.certification-action.primary {
  color: #ffffff;
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.certification-action:hover:not(:disabled) {
  border-color: var(--color-accent-primary);
}

.certification-action:active:not(:disabled) {
  transform: translateY(1px);
}

.certification-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.certification-status {
  min-height: 1.25rem;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  text-align: center;
}
</style>
