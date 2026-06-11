<template>
  <BaseModal
    :model-value="true"
    title="프로필 편집"
    size="md"
    :close-on-overlay="true"
    :close-on-esc="true"
    @update:model-value="handleClose"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="profile-edit-form">
      <!-- 프로필 이미지 -->
      <div class="form-group">
        <label class="form-label">프로필 이미지</label>
        <div class="avatar-section">
          <div class="avatar-wrapper">
            <NuxtImg
              v-if="profile.user.profile_image && !imageError"
              :src="profile.user.profile_image"
              :alt="profile.user.nickname"
              class="avatar-image"
              loading="lazy"
              @error="handleImageError"
            />
            <div v-else class="avatar-placeholder">
              <UserIcon :size="32" />
            </div>
          </div>
          <p class="form-hint">소셜 로그인 계정에서 가져옵니다.</p>
        </div>
      </div>

      <!-- 닉네임 (읽기 전용) -->
      <div class="form-group">
        <label class="form-label">닉네임</label>
        <input
          type="text"
          :value="profile.user.nickname"
          disabled
          class="form-input disabled"
        >
      </div>

      <!-- 자기소개 -->
      <div class="form-group">
        <label for="bio" class="form-label">자기소개</label>
        <textarea
          id="bio"
          v-model="bio"
          rows="4"
          maxlength="500"
          class="form-textarea"
          placeholder="자신을 소개해주세요 (최대 500자)"
        ></textarea>
        <p class="form-hint char-count">{{ bio.length }}/500</p>
      </div>

      <!-- 프로필 공개 설정 -->
      <div class="form-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="isPublic"
            class="checkbox-input"
          >
          <span>프로필 공개</span>
        </label>
        <p class="form-hint checkbox-hint">
          비공개로 설정하면 팔로워만 프로필을 볼 수 있습니다.
        </p>
      </div>
    </form>

    <template #footer>
      <div class="modal-footer-content">
        <button
          type="button"
          @click="handleClose"
          class="btn-secondary"
        >
          취소
        </button>
        <button
          type="button"
          @click="handleSubmit"
          :disabled="isSaving"
          class="btn-primary"
        >
          {{ isSaving ? '저장 중...' : '저장' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProfileStore } from '~/stores/profile'
import { useModal } from '~/composables/useModal'
import BaseModal from '~/components/ui/modal/BaseModal.vue'
import { UserIcon } from '@lucide/vue'

interface ProfileData {
  user: {
    id: number
    nickname: string
    profile_image?: string
  }
  bio: string
  is_public: boolean
}

const props = defineProps<{
  profile: ProfileData
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const profileStore = useProfileStore()
const modal = useModal()

const bio = ref('')
const isPublic = ref(true)
const isSaving = ref(false)
const imageError = ref(false)

const handleClose = () => {
  emit('close')
}

const handleImageError = () => {
  imageError.value = true
}

onMounted(() => {
  bio.value = props.profile.bio || ''
  isPublic.value = props.profile.is_public
})

const handleSubmit = async () => {
  isSaving.value = true

  try {
    const result = await profileStore.updateProfile(bio.value, isPublic.value)

    if (result.success) {
      emit('saved')
      emit('close')
    } else {
      await modal.alert({
        title: '저장 실패',
        description: result.error || '프로필 저장에 실패했습니다.',
        icon: 'error'
      })
    }
  } catch (error) {
    await modal.alert({
      title: '오류 발생',
      description: '프로필 저장 중 오류가 발생했습니다.',
      icon: 'error'
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.profile-edit-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--color-border, #E2E8F0);
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #EFF6FF;
  color: #3B82F6;
  font-size: 1.5rem;
}

.form-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border, #E2E8F0);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary, #1E293B);
  background-color: var(--color-bg-card, #fff);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.disabled {
  background: var(--color-bg-secondary, #F8FAFC);
  color: var(--text-secondary, #94A3B8);
  cursor: not-allowed;
}

.form-textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border, #E2E8F0);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary, #1E293B);
  background-color: var(--color-bg-card, #fff);
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  transition: all 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-hint {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748B);
  margin: 0;
}

.char-count {
  text-align: right;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: var(--text-primary, #1E293B);
}

.checkbox-input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: #3B82F6;
  cursor: pointer;
}

.checkbox-hint {
  margin-left: 1.75rem;
}

.modal-footer-content {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}

.btn-secondary,
.btn-primary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.btn-secondary {
  background: var(--color-bg-secondary, #F1F5F9);
  color: var(--text-secondary, #475569);
}

.btn-secondary:hover {
  background: var(--color-bg-hover, #E2E8F0);
}

.btn-primary {
  background: #1E293B;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #334155;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark mode support */
:root.dark .avatar-placeholder {
  background: rgba(59, 130, 246, 0.2);
}

:root.dark .form-input,
:root.dark .form-textarea {
  background-color: var(--color-bg-card);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .form-input.disabled {
  background-color: var(--color-bg-secondary);
}
</style>
