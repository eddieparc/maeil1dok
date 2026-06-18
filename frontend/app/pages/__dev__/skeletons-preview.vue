<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Skeleton from '~/components/ui/skeleton/Skeleton.vue'
import SkeletonText from '~/components/ui/skeleton/SkeletonText.vue'
import SkeletonAvatar from '~/components/ui/skeleton/SkeletonAvatar.vue'
import SkeletonCard from '~/components/ui/skeleton/SkeletonCard.vue'
import SkeletonListItem from '~/components/ui/skeleton/SkeletonListItem.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'
import SkeletonStats from '~/components/ui/skeleton/SkeletonStats.vue'
import SkeletonLeaderboardRow from '~/components/ui/skeleton/SkeletonLeaderboardRow.vue'
import SkeletonGroupCard from '~/components/ui/skeleton/SkeletonGroupCard.vue'
import SkeletonProfileHeader from '~/components/ui/skeleton/SkeletonProfileHeader.vue'
import SkeletonHasenaCard from '~/components/ui/skeleton/SkeletonHasenaCard.vue'
import SkeletonPlanRow from '~/components/ui/skeleton/SkeletonPlanRow.vue'

// Production guard: this dev preview must never ship to production.
if (import.meta.server) {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}

definePageMeta({
  layout: false,
  title: '스켈레톤 미리보기 (dev)'
})

const currentTheme = ref<'light' | 'dark'>('light')

const applyTheme = (theme: 'light' | 'dark') => {
  currentTheme.value = theme
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

onMounted(() => {
  // Honor existing theme if set on document, otherwise default to light.
  const existing = document.documentElement.getAttribute('data-theme') as
    | 'light'
    | 'dark'
    | null
  if (existing === 'dark') {
    currentTheme.value = 'dark'
  } else {
    applyTheme('light')
  }
})

const listVariants = [
  'note',
  'bookmark',
  'highlight',
  'history',
  'user',
  'plan',
  'schedule'
] as const

const avatarSizes = ['sm', 'md', 'lg', 'xl'] as const
const skeletonRounds = ['sm', 'md', 'lg', 'xl', 'full'] as const
</script>

<template>
  <div class="min-h-screen bg-primary text-primary p-6">
    <header class="max-w-5xl mx-auto mb-8 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold mb-1">스켈레톤 미리보기 (dev)</h1>
        <p class="text-sm text-secondary">
          atom + composite 모든 변형. light / dark 토글로 확인.
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          :class="[
            'px-4 py-2 rounded-[8px] text-sm font-medium border',
            currentTheme === 'light'
              ? 'bg-card border-default'
              : 'bg-tertiary border-default'
          ]"
          @click="applyTheme('light')"
        >
          Light
        </button>
        <button
          type="button"
          :class="[
            'px-4 py-2 rounded-[8px] text-sm font-medium border',
            currentTheme === 'dark'
              ? 'bg-card border-default'
              : 'bg-tertiary border-default'
          ]"
          @click="applyTheme('dark')"
        >
          Dark
        </button>
      </div>
    </header>

    <main class="max-w-5xl mx-auto flex flex-col gap-12">
      <!-- Atom -->
      <section>
        <h2 class="text-lg font-semibold mb-4">Skeleton (atom)</h2>
        <div class="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div v-for="r in skeletonRounds" :key="r" class="flex flex-col gap-2">
            <span class="text-xs text-secondary">rounded={{ r }}</span>
            <Skeleton width="100%" height="48px" :rounded="r" />
          </div>
        </div>
      </section>

      <!-- Text -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonText</h2>
        <div class="bg-card border border-default rounded-[12px] p-4 max-w-md">
          <SkeletonText :lines="4" lastLineWidth="50%" />
        </div>
      </section>

      <!-- Avatar -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonAvatar</h2>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div v-for="s in avatarSizes" :key="s" class="bg-card border border-default rounded-[12px] p-4">
            <p class="text-xs text-secondary mb-3">size={{ s }}</p>
            <SkeletonAvatar :size="s" :withCaption="true" />
          </div>
        </div>
      </section>

      <!-- Card -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonCard (default + slots)</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard rounded="xl">
            <template #header>
              <Skeleton width="40%" height="1.5rem" />
            </template>
            <template #body>
              <SkeletonText :lines="4" lastLineWidth="65%" />
            </template>
            <template #footer>
              <Skeleton width="6rem" height="2rem" rounded="md" />
            </template>
          </SkeletonCard>
        </div>
      </section>

      <!-- List variants -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonList variants</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            v-for="variant in listVariants"
            :key="variant"
            class="bg-card border border-default rounded-[12px] p-4"
          >
            <p class="text-xs text-secondary mb-3">variant={{ variant }}</p>
            <SkeletonList :count="3" :variant="variant" />
          </div>
        </div>
      </section>

      <!-- Calendar -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonCalendar</h2>
        <div class="bg-card border border-default rounded-[12px] p-4 max-w-md">
          <SkeletonCalendar :weeks="5" />
        </div>
      </section>

      <!-- Stats -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonStats</h2>
        <SkeletonStats :count="3" />
      </section>

      <!-- Leaderboard row -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonLeaderboardRow</h2>
        <div class="flex flex-col gap-2 max-w-2xl">
          <SkeletonLeaderboardRow v-for="i in 4" :key="i" />
        </div>
      </section>

      <!-- Group card -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonGroupCard</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonGroupCard v-for="i in 3" :key="i" />
        </div>
      </section>

      <!-- Profile header -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonProfileHeader</h2>
        <div class="max-w-md">
          <SkeletonProfileHeader />
        </div>
      </section>

      <!-- Hasena card -->
      <section>
        <h2 class="text-lg font-semibold mb-4">SkeletonHasenaCard</h2>
        <div class="max-w-2xl">
          <SkeletonHasenaCard />
        </div>
      </section>

      <!-- Plan rows -->
      <section class="mb-12">
        <h2 class="text-lg font-semibold mb-4">SkeletonPlanRow</h2>
        <div class="flex flex-col gap-3 max-w-2xl">
          <SkeletonPlanRow v-for="i in 3" :key="i" />
        </div>
      </section>
    </main>
  </div>
</template>
