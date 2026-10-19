<template>
  <UserListModal
    :is-open="isOpen"
    title="팔로워"
    :users="followers"
    :is-loading="isLoading"
    empty-title="팔로워가 없습니다"
    empty-description="다른 사용자들과 교류해보세요!"
    @close="handleClose"
  >
    <template #action="{ user }">
      <AppButton
        v-if="!user.is_me"
        :variant="user.is_following ? 'secondary' : 'primary'"
        size="sm"
        :loading="loadingIds[user.id]"
        @click.stop="toggleFollow(user)"
      >{{ user.is_following ? '팔로잉' : '팔로우' }}</AppButton>
    </template>
  </UserListModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UserListModal from '../common/UserListModal.vue'
import AppButton from '../ui/AppButton.vue'

interface Follower {
  id: number
  nickname: string
  profile_image?: string | null
  bio?: string
  is_following?: boolean
  is_me?: boolean
}

const props = withDefaults(defineProps<{
  isOpen: boolean
  followersData: Follower[]
  isLoading?: boolean
}>(), {
  isLoading: false
})

const emit = defineEmits<{
  close: []
  toggleFollow: [follower: Follower]
}>()

const loadingIds = ref<Record<number, boolean>>({})

const followers = computed(() => props.followersData)

const handleClose = () => {
  emit('close')
}

const toggleFollow = async (follower: Follower) => {
  if (loadingIds.value[follower.id]) return

  loadingIds.value[follower.id] = true
  try {
    emit('toggleFollow', follower)
    await new Promise(resolve => setTimeout(resolve, 300))
  } finally {
    loadingIds.value[follower.id] = false
  }
}
</script>
