<script setup lang="ts">
import { ref } from 'vue'
import { Upload } from '@lucide/vue'
import AdminConsoleLayout from '~/components/admin/AdminConsoleLayout.vue'
import AdminVideoIntroContent from '~/components/admin/AdminVideoIntroContent.vue'
import AppButton from '~/components/ui/AppButton.vue'

const content = ref<InstanceType<typeof AdminVideoIntroContent> | null>(null)
const planName = ref('')
</script>

<template>
  <AdminConsoleLayout active-path="/admin/video/intro">
    <template #title>
      <h1>개론 영상<span v-if="planName"> · {{ planName }}</span></h1>
      <p class="admin-video-summary">플랜 주차별 개론 영상 링크를 관리해요.</p>
    </template>
    <template #actions>
      <AppButton data-open-upload="true" @click="content?.openUploadModal()">
        <Upload :size="18" aria-hidden="true" />
        엑셀 업로드
      </AppButton>
    </template>
    <AdminVideoIntroContent ref="content" @plan-name-change="planName = $event" />
  </AdminConsoleLayout>
</template>

<style scoped>
.admin-video-summary {
  margin: 4px 0 0;
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}
</style>
