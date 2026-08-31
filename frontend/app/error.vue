<script setup lang="ts">
import type { NuxtError } from '#app'
import { ref, onMounted } from 'vue'
import * as Sentry from '@sentry/nuxt'

const props = defineProps({
  error: Object as () => NuxtError
})

const handleError = () => clearError({ redirect: '/' })

const errorMessages: Record<number, { title: string; description: string }> = {
  404: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 페이지가 존재하지 않거나 이동되었습니다.'
  },
  500: {
    title: '서버 오류가 발생했습니다',
    description: '잠시 후 다시 시도해 주세요.'
  },
  403: {
    title: '접근 권한이 없습니다',
    description: '이 페이지에 접근할 수 없습니다.'
  }
}

const statusCode = props.error?.statusCode || 500
const errorInfo = errorMessages[statusCode] || {
  title: '오류가 발생했습니다',
  description: props.error?.message || '알 수 없는 오류가 발생했습니다.'
}

const isAutoRecovering = ref(false)
const showError = ref(false)

onMounted(() => {
  if (statusCode === 500) {
    isAutoRecovering.value = true
    Sentry.captureException(props.error, {
      tags: { handled: 'true', error_surface: 'nuxt_error_page' }
    })
    console.error('[error.vue] SSR 500 error detected, auto-recovering...', props.error?.message)
    setTimeout(() => {
      clearError({ redirect: '/' })
    }, 100)
  } else {
    showError.value = true
  }
})
</script>

<template>
  <!-- 500 에러 자동 복구 중: 로딩 표시 -->
  <div v-if="isAutoRecovering || !showError" class="min-h-screen flex items-center justify-center bg-bg-primary">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  </div>

  <!-- 일반 에러 (404, 403 등): 에러 페이지 표시 -->
  <div v-else class="min-h-screen flex items-center justify-center bg-bg-primary px-4">
    <div class="max-w-md w-full text-center">
      <div class="mb-6">
        <span class="text-8xl font-bold text-accent-primary">{{ statusCode }}</span>
      </div>

      <h1 class="text-2xl font-bold text-txt-primary mb-3">
        {{ errorInfo.title }}
      </h1>

      <p class="text-txt-secondary mb-8">
        {{ errorInfo.description }}
      </p>

      <div class="space-y-3">
        <button
          @click="handleError"
          class="w-full btn btn-primary"
          aria-label="홈으로 돌아가기"
        >
          홈으로 돌아가기
        </button>

        <button
          @click="$router.back()"
          class="w-full px-4 py-3 border border-border rounded-lg bg-bg-secondary text-txt-primary hover:bg-bg-hover transition-colors"
          aria-label="이전 페이지로 돌아가기"
        >
          이전 페이지로 돌아가기
        </button>
      </div>

      <p class="mt-8 text-sm text-txt-tertiary">
        문제가 계속되면
        <a
          href="mailto:support@maeil1dok.app"
          class="text-link hover:text-link-hover hover:underline"
        >
          고객지원
        </a>
        에 문의해 주세요.
      </p>
    </div>
  </div>
</template>
