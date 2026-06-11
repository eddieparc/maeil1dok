<template>
  <div class="user-card">
    <NuxtLink :to="`/profile/${user.id}`" class="user-info">
      <NuxtImg
        v-if="user.profile_image"
        :src="user.profile_image"
        :alt="user.nickname"
        class="user-avatar"
        loading="lazy"
      />
      <div v-else class="user-avatar-placeholder">
        <UserIcon :size="20" />
      </div>
      
      <div class="user-details">
        <p class="user-nickname">{{ user.nickname }}</p>
        <p class="user-username">@{{ user.username }}</p>
        <div v-if="user.bio" class="user-bio">{{ user.bio }}</div>
        <div class="user-stats">
          <span v-if="user.followers_count !== undefined">
            팔로워 {{ user.followers_count }}
          </span>
          <span v-if="user.following_count !== undefined">
            팔로잉 {{ user.following_count }}
          </span>
        </div>
      </div>
    </NuxtLink>
    
    <div class="user-actions">
      <button
        v-if="!isOwnProfile"
        @click="toggleFollow"
        :disabled="isLoading"
        :class="[
          'follow-button',
          user.is_following ? 'following' : 'not-following',
          { 'loading': isLoading }
        ]"
      >
        <span v-if="isLoading" class="loading-spinner"></span>
        <span v-else>{{ user.is_following ? '팔로잉' : '팔로우' }}</span>
      </button>
      
      <div v-if="user.is_mutual_follow || user.is_friend" class="mutual-badge">
        <UsersIcon :size="16" />
        친구
      </div>
    </div>
  </div>
</template>

<script setup>
import { UserIcon, UsersIcon } from '@lucide/vue'
import { ref, computed } from 'vue'
import { useAuthService } from '~/composables/useAuthService'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['follow', 'unfollow'])

const auth = useAuthService()
const isLoading = ref(false)

const isOwnProfile = computed(() => {
  return auth.user.value?.id === props.user.id
})

const toggleFollow = async () => {
  // 중복 클릭 방지
  if (isLoading.value) return

  isLoading.value = true

  // Optimistic UI update
  const prevState = props.user.is_following
  props.user.is_following = !prevState

  try {
    if (!prevState) {
      emit('follow', props.user.id)
    } else {
      emit('unfollow', props.user.id)
    }
  } catch (error) {
    // Revert on error
    props.user.is_following = prevState
    console.error('Failed to toggle follow:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.user-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  transition: all 0.2s ease;
}

.user-card:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.user-info {
  display: flex;
  gap: 0.75rem;
  flex: 1;
  text-decoration: none;
  color: inherit;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-nickname {
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  font-size: 0.95rem;
}

.user-username {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0.125rem 0;
}

.user-bio {
  color: var(--text-primary);
  font-size: 0.875rem;
  margin: 0.5rem 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.user-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.user-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.follow-button {
  padding: 0.375rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.follow-button.not-following {
  background: var(--primary-color);
  color: var(--color-text-inverse);
  border: 1px solid var(--primary-color);
}

.follow-button.not-following:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.follow-button.following {
  background: var(--color-bg-card);
  color: var(--text-primary);
  border: 1px solid var(--color-border-default);
}

.follow-button.following:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
  border-color: var(--color-error);
}

.follow-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.follow-button.loading {
  pointer-events: none;
}

.loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.mutual-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--primary-color);
  background: var(--primary-light);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.mutual-badge svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 640px) {
  .user-card {
    padding: 0.75rem;
  }
  
  .user-avatar,
  .user-avatar-placeholder {
    width: 40px;
    height: 40px;
  }
}
</style>
