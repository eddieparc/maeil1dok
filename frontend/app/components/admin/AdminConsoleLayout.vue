<script setup lang="ts">
import { useCdnAsset } from '~/composables/useCdnAsset';
import { computed, onMounted, ref, useId } from 'vue'
import { useRoute } from 'vue-router'
import { NuxtLink } from '#components'
import { BookOpen, CalendarDays, LogIn, ShieldAlert, Sparkles, UserRound, Users, Video, WifiOff } from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
const { cdnAsset } = useCdnAsset();

const props = withDefaults(defineProps<{
  title?: string
  activePath?: string
}>(), { title: '관리자 콘솔' })

const auth = useAuthService()
const route = useRoute()
const mainId = `admin-main-${useId()}`
const retrying = ref(false)

// This is a rendering boundary, not a second auth authority. In particular,
// isStaff alone can reflect an unverified cached user during initialization.
const state = computed(() => {
  if (!auth.isInitialized.value || auth.isLoading.value) return 'loading'
  if (auth.isSessionUnknown.value) return 'offline'
  if (!auth.isAuthenticated.value) return 'guest'
  return auth.isStaff.value ? 'staff' : 'denied'
})
const loginTo = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }))
const activeLocation = computed(() => props.activePath ?? `${route.path}${route.hash}`)
const items = [
  { label: '회원', to: '/admin/members', icon: Users },
  { label: '플랜', to: '/admin/plans', icon: BookOpen },
  // H06 keeps the schedule workspace on the plans page, not a separate route.
  { label: '일정', to: '/admin/plans#schedules', icon: CalendarDays },
  { label: '하세나 AI 요약', to: '/admin/hasena', icon: Sparkles },
  { label: '개론 영상', to: '/admin/video/intro', icon: Video },
]
function isActive(to: string): boolean {
  const path = activeLocation.value.split(/[?#]/)[0]
  const schedules = path === '/admin/plans' && activeLocation.value.endsWith('#schedules')
  if (to === '/admin/plans#schedules') return schedules
  if (to === '/admin/plans' && schedules) return false
  return path === to || path?.startsWith(`${to}/`) === true
}

onMounted(() => auth.initialize())

async function retry(): Promise<void> {
  if (retrying.value) return
  retrying.value = true
  try {
    await auth.revalidate()
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <div class="admin-console">
    <a class="admin-skip" :href="`#${mainId}`">본문으로 건너뛰기</a>
    <aside class="admin-sidebar">
      <NuxtLink to="/" class="admin-brand" aria-label="매일일독 홈">
        <img :src="cdnAsset('/images/logo-transparent.png')" alt="매일일독" width="376" height="99" />
        <span class="admin-badge">ADMIN</span>
      </NuxtLink>

      <template v-if="state === 'staff'">
        <nav class="admin-nav" aria-label="관리자 메뉴">
          <NuxtLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            class="admin-nav-item"
            :class="{ 'is-active': isActive(item.to) }"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <component :is="item.icon" :size="20" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <NuxtLink :to="`/profile/${auth.user.value?.id}`" class="admin-profile">
          <span class="admin-avatar" aria-hidden="true">
            <img v-if="auth.user.value?.profile_image" :src="auth.user.value.profile_image" alt="" width="32" height="32" />
            <UserRound v-else :size="20" />
          </span>
          <span class="admin-profile-copy">
            <span class="admin-profile-name">{{ auth.user.value?.nickname || auth.user.value?.username }}</span>
            <span class="admin-profile-caption">staff<span v-if="auth.user.value?.email"> · {{ auth.user.value.email }}</span></span>
          </span>
        </NuxtLink>
      </template>
    </aside>

    <main :id="mainId" class="admin-main" tabindex="-1" :data-admin-state="state" :aria-busy="state === 'loading' || undefined">
      <!-- All slots are lazy and inside the same staff-only branch. Put data-
           owning components here; parent page setup itself is not gated. -->
      <template v-if="state === 'staff'">
        <header class="admin-heading">
          <div class="admin-title"><slot name="title"><h1>{{ title }}</h1></slot></div>
          <div v-if="$slots.actions" class="admin-actions"><slot name="actions" /></div>
        </header>
        <div class="admin-content"><slot /></div>
      </template>

      <section v-else-if="state === 'loading'" class="admin-loading" role="status" aria-label="관리자 권한 확인 중">
        <h1 class="admin-state-title">관리자 권한을 확인하고 있어요</h1>
        <Skeleton width="40%" :height="24" />
        <div class="admin-loading-summary">
          <Skeleton v-for="index in 4" :key="index" :height="88" />
        </div>
        <Skeleton v-for="index in 6" :key="index" :height="56" />
      </section>

      <section v-else-if="state === 'offline'" class="admin-state" role="status">
        <WifiOff :size="32" aria-hidden="true" />
        <h1 class="admin-state-title">로그인 상태를 확인하지 못했어요</h1>
        <p>연결을 확인한 뒤 다시 시도해주세요. 관리자 권한이 확인되면 콘솔을 열 수 있어요.</p>
        <div class="admin-state-actions">
          <AppButton data-admin-retry :loading="retrying" @click="retry">다시 시도</AppButton>
          <AppButton to="/" variant="ghost">홈으로</AppButton>
        </div>
      </section>

      <section v-else-if="state === 'guest'" class="admin-state">
        <LogIn :size="32" aria-hidden="true" />
        <h1 class="admin-state-title">관리자 로그인이 필요해요</h1>
        <p>관리자 계정으로 로그인해주세요. 로그인 후 이 화면으로 돌아와요.</p>
        <div class="admin-state-actions">
          <AppButton :to="loginTo">로그인</AppButton>
          <AppButton to="/" variant="ghost">홈으로</AppButton>
        </div>
      </section>

      <section v-else class="admin-state" role="alert">
        <ShieldAlert :size="32" aria-hidden="true" />
        <h1 class="admin-state-title">권한이 없습니다</h1>
        <p>관리자만 접근할 수 있는 화면이에요.</p>
        <AppButton to="/" variant="secondary">홈으로</AppButton>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-console {
  min-height: 100svh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  letter-spacing: var(--tracking-body);
}
.admin-sidebar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px var(--screen-gutter);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-default);
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  width: fit-content;
  padding-inline: 12px;
  border-radius: var(--radius-control);
  text-decoration: none;
}
.admin-brand img { width: auto; height: 22px; }
[data-theme="dark"] .admin-brand img { filter: brightness(0) invert(1); }
.admin-badge {
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  color: var(--color-accent-primary);
  background: var(--color-accent-bg);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.admin-nav { display: flex; flex-wrap: wrap; gap: 4px; }
.admin-nav-item, .admin-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 8px 12px;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.admin-nav-item svg { flex-shrink: 0; }
.admin-brand:hover, .admin-nav-item:hover, .admin-profile:hover { background: var(--color-bg-hover); }
.admin-nav-item.is-active { color: var(--color-accent-primary); background: var(--color-accent-bg); border-color: var(--color-accent-primary); }
.admin-brand:active, .admin-nav-item:active, .admin-profile:active { transform: scale(.97); }
.admin-profile { border-top-color: var(--color-border-light); }
.admin-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}
.admin-avatar img { width: 32px; height: 32px; object-fit: cover; }
.admin-profile-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.admin-profile-name { color: var(--color-text-primary); font-size: 13px; }
.admin-profile-caption { color: var(--color-text-secondary); font-size: 11px; font-weight: 400; }
.admin-profile-name, .admin-profile-caption { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-main { min-width: 0; padding: 24px var(--screen-gutter) max(24px, env(safe-area-inset-bottom)); }
.admin-heading { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.admin-title { min-width: 0; overflow-wrap: anywhere; }
.admin-title :deep(h1), .admin-state-title { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.admin-actions, .admin-state-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.admin-content { min-width: 0; }
.admin-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 560px;
  margin: 40px auto;
  padding: var(--card-padding);
  text-align: center;
  border: 1px solid var(--color-border-default);
  border-radius: 20px;
  background: var(--color-bg-card);
}
.admin-state > svg { color: var(--color-accent-primary); }
.admin-state p { margin: 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.5; }
.admin-loading { display: grid; gap: 12px; }
.admin-loading-summary { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin-block: 12px; }
.admin-skip {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  display: flex;
  align-items: center;
  min-height: var(--hit-min);
  padding: 0 16px;
  border-radius: var(--radius-control);
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  transform: translateY(calc(-100% - 12px));
}
.admin-skip:focus { transform: none; }
.admin-brand:focus-visible, .admin-nav-item:focus-visible, .admin-profile:focus-visible, .admin-skip:focus-visible, .admin-main:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
}
@media (min-width: 1024px) {
  .admin-console { display: grid; grid-template-columns: var(--sidebar-width) minmax(0, 1fr); }
  .admin-sidebar { position: sticky; top: 0; align-self: start; height: 100svh; overflow-y: auto; padding: 24px 16px; border-bottom: 0; border-right: 1px solid var(--color-border-default); }
  .admin-nav { flex-direction: column; flex-wrap: nowrap; }
  .admin-profile { margin-top: auto; }
  .admin-main { padding: 24px; }
  .admin-heading { flex-direction: row; align-items: center; justify-content: space-between; }
  .admin-loading-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .admin-nav-item, .admin-profile { transition: none; }
  .admin-brand:active, .admin-nav-item:active, .admin-profile:active { transform: none; }
}
</style>
