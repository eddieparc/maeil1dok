<template>
  <div class="merge-modal-content">
    <h3 :id="`modal-title-${modalId}`" class="modal-title">계정 병합</h3>
    <p class="merge-description">
      이 {{ getProviderDisplayName(mergeInfo.provider) }} 계정은 다른 매일일독 계정에 연결되어 있습니다.<br>
      <strong>어느 계정을 유지하시겠습니까?</strong>
    </p>

    <div class="merge-accounts">
      <div class="account-card">
        <div class="account-badge">현재 로그인</div>
        <div class="account-avatar">
          <NuxtImg v-if="mergeInfo.current_account.profile_image" :src="mergeInfo.current_account.profile_image" alt="" loading="lazy" />
          <div v-else class="avatar-placeholder">{{ mergeInfo.current_account.nickname?.charAt(0) || '?' }}</div>
        </div>
        <div class="account-info">
          <p class="account-nickname">{{ mergeInfo.current_account.nickname }}</p>
          <p class="account-email">{{ mergeInfo.current_account.email || '이메일 없음' }}</p>
          <p class="account-providers">
            <span v-for="p in mergeInfo.current_account.providers" :key="p" class="provider-tag">{{ getProviderDisplayName(p) }}</span>
            <span v-if="mergeInfo.current_account.has_password" class="provider-tag password">비밀번호</span>
          </p>
          <p class="account-date">가입: {{ formatDate(mergeInfo.current_account.created_at) }}</p>
        </div>
        <button class="select-btn" :disabled="busy" @click.stop="select('current')">이 계정 유지</button>
      </div>

      <div class="account-card">
        <div class="account-badge other">{{ getProviderDisplayName(mergeInfo.provider) }} 연결 계정</div>
        <div class="account-avatar">
          <NuxtImg v-if="mergeInfo.other_account.profile_image" :src="mergeInfo.other_account.profile_image" alt="" loading="lazy" />
          <div v-else class="avatar-placeholder">{{ mergeInfo.other_account.nickname?.charAt(0) || '?' }}</div>
        </div>
        <div class="account-info">
          <p class="account-nickname">{{ mergeInfo.other_account.nickname }}</p>
          <p class="account-email">{{ mergeInfo.other_account.email || '이메일 없음' }}</p>
          <p class="account-providers">
            <span v-for="p in mergeInfo.other_account.providers" :key="p" class="provider-tag">{{ getProviderDisplayName(p) }}</span>
            <span v-if="mergeInfo.other_account.has_password" class="provider-tag password">비밀번호</span>
          </p>
          <p class="account-date">가입: {{ formatDate(mergeInfo.other_account.created_at) }}</p>
        </div>
        <button class="select-btn" :disabled="busy" @click.stop="select('other')">이 계정 유지</button>
      </div>
    </div>

    <p class="merge-warning">
      선택하지 않은 계정은 30일 후 완전히 삭제됩니다.<br>
      해당 계정의 소셜 연결만 유지 계정으로 이전됩니다.
    </p>

    <button class="btn-cancel-full" @click="cancel" :disabled="busy">취소</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useModal } from '~/composables/useModal'
import { getProviderDisplayName } from '~/utils/accountSettingsRuntime'
import type { KeepAccount, MergeInfo } from './types'

const props = defineProps<{
  modalId: string
  mergeInfo: MergeInfo
  onSelect: (keepAccount: KeepAccount) => Promise<void>
}>()

const modal = useModal()
const busy = ref(false)

const select = async (keepAccount: KeepAccount) => {
  if (busy.value) return
  busy.value = true
  try {
    // 성공 시 부모가 모달을 닫는다. 실패하면 버튼을 다시 활성화해 재시도할 수 있다.
    await props.onSelect(keepAccount)
  } finally {
    busy.value = false
  }
}

const cancel = () => {
  modal.close(props.modalId)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<style scoped>
.merge-modal-content {
  width: 100%;
  max-height: 90dvh;
  overflow-y: auto;
  padding: 20px;
}
.modal-title { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
.merge-description { margin: 0 0 20px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.6; }
.merge-accounts { display: grid; gap: 14px; }
.account-card { padding: 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); }
.account-badge { display: inline-flex; margin-bottom: 12px; padding: 4px 8px; border-radius: var(--radius-pill); background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 11px; font-weight: 600; }
.account-avatar { width: 48px; height: 48px; margin-bottom: 12px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--color-accent-primary-light); }
.account-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: var(--color-accent-primary); background: var(--color-accent-primary-light); font-size: 20px; font-weight: 700; }
.account-nickname, .account-email, .account-providers, .account-date { margin: 0; }
.account-nickname { font-weight: 700; }
.account-email, .account-date { color: var(--color-text-secondary); font-size: 12px; }
.account-providers { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
.provider-tag { padding: 3px 8px; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
.merge-warning { margin: 16px 0 0; padding: 12px; border-radius: var(--radius-control); color: var(--color-error); background: var(--color-error-bg); font-size: 12px; line-height: 1.5; }
.select-btn, .btn-cancel-full { width: 100%; padding: 10px 16px; margin-top: 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.select-btn { background: var(--color-accent-primary); color: var(--color-text-inverse); border-color: var(--color-accent-primary); }
button { min-width: 44px; min-height: 44px; cursor: pointer; transition: background var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:hover:not(:disabled) { background-color: var(--color-bg-hover); }
button:active:not(:disabled) { transform: scale(0.97); }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  button:active:not(:disabled) { transform: none; }
}
</style>
