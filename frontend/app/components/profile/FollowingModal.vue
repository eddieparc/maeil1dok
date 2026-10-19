<template>
  <UserListModal
    :is-open="isOpen"
    title="팔로잉"
    :users="following"
    :is-loading="isLoading"
    empty-title="팔로잉이 없습니다"
    empty-description="다른 사용자를 팔로우해보세요!"
    @close="handleClose"
  >
    <template #action="{ user }">
      <AppButton
        variant="secondary"
        size="sm"
        :loading="loadingIds[user.id]"
        @click.stop="handleUnfollow(user)"
      >팔로잉</AppButton>
    </template>
  </UserListModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UserListModal from '../common/UserListModal.vue'
import AppButton from '../ui/AppButton.vue'

interface FollowingUser {
  id: number
  nickname: string
  profile_image?: string | null
  bio?: string
}

const props = withDefaults(defineProps<{
  isOpen: boolean
  followingData: FollowingUser[]
  isLoading?: boolean
}>(), {
  isLoading: false
})

const emit = defineEmits<{
  close: []
  unfollow: [user: FollowingUser]
}>()

const loadingIds = ref<Record<number, boolean>>({})

const following = computed(() => props.followingData)

const handleClose = () => {
  emit('close')
}

const handleUnfollow = async (user: FollowingUser) => {
  if (loadingIds.value[user.id]) return

  loadingIds.value[user.id] = true
  try {
    emit('unfollow', user)
    await new Promise(resolve => setTimeout(resolve, 300))
  } finally {
    loadingIds.value[user.id] = false
  }
}
</script>
