<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { UsersIcon, ChevronRightIcon } from '@lucide/vue';
import { useApi } from '~/composables/useApi';
import type { components } from '~/types/generated/api-schema';
import Skeleton from '~/components/ui/Skeleton.vue';
import AppButton from '~/components/ui/AppButton.vue';

const props = defineProps<{ userId?: number; today: string }>();
const api = useApi();
const hasenaLoading = ref(true);
const groupLoading = ref(true);
const hasena = ref<components['schemas']['HasenaCalendarEntry'] | null>(null);
const group = ref<components['schemas']['ReadingGroupResponse'] | null>(null);
const groupDay = ref<components['schemas']['GroupProgressDay'] | null>(null);
const hasenaError = ref(false);
const groupError = ref(false);
const retry = ref(0);
const groupProgress = computed(() => groupDay.value?.total_members
  ? Math.round(groupDay.value.completed_count / groupDay.value.total_members * 100)
  : null);
const thumbnail = computed(() => hasena.value?.video_id
  ? `https://i.ytimg.com/vi/${encodeURIComponent(hasena.value.video_id)}/hqdefault.jpg`
  : '');

onMounted(() => {
  // 하세나 영상은 로그인 여부와 무관하게 오늘의 썸네일을 보여준다.
  // userId 해석을 기다리지 않고 즉시 가져온다(인증 확인 전후로 watcher가
  // 두 번 발화해 같은 요청이 중복되던 것을 방지).
  watch([() => props.today, retry], async (_, __, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    hasenaLoading.value = true;
    hasena.value = null;
    hasenaError.value = false;
    const params = { year: Number(props.today.slice(0, 4)), month: Number(props.today.slice(5, 7)) };
    try {
      const { data } = await api.GET('/api/v1/todos/hasena/calendar/', { params });
      if (!data.success) throw new Error('하세나를 불러오지 못했습니다.');
      // 오늘 영상이 아직 없으면(주말·미게시) 가장 최근 영상을 보여준다.
      const entries = data.entries.filter(entry => entry.date <= props.today);
      const entry = entries.find(e => e.date === props.today) ?? entries.at(-1) ?? null;
      if (!active) return;
      hasena.value = entry;
    } catch {
      if (!active) return;
      hasenaError.value = true;
    }
    hasenaLoading.value = false;
  }, { immediate: true });

  // 그룹 진도는 로그인 사용자에게만 보인다.
  watch([() => props.userId, () => props.today, retry], async ([userId], _, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    groupLoading.value = true;
    group.value = null;
    groupDay.value = null;
    groupError.value = false;
    if (!userId) {
      groupLoading.value = false;
      return;
    }
    const params = { year: Number(props.today.slice(0, 4)), month: Number(props.today.slice(5, 7)) };
    try {
      const { data } = await api.GET('/api/v1/todos/groups/', { params: { only_mine: true } });
      if (!data.success) throw new Error('그룹을 불러오지 못했습니다.');
      const firstGroup = data.groups[0] ?? null;
      let day: components['schemas']['GroupProgressDay'] | null = null;
      if (firstGroup && firstGroup.plans.length) {
        const response = await api.GET(api.path('/api/v1/todos/groups/{group_id}/member-progress/', { group_id: firstGroup.id }), {
          params: { ...params, plan_id: firstGroup.plans[0]!.id },
        });
        if (!response.data.success) throw new Error('그룹 진도를 불러오지 못했습니다.');
        day = response.data.calendar[props.today] ?? null;
      }
      if (!active) return;
      group.value = firstGroup;
      groupDay.value = day;
    } catch {
      if (!active) return;
      groupError.value = true;
    }
    groupLoading.value = false;
  }, { immediate: true });
});
</script>

<template>
  <section class="aside-card" aria-labelledby="home-hasena-title" :aria-busy="hasenaLoading">
    <h2 id="home-hasena-title">하세나하시조</h2>
    <Skeleton v-if="hasenaLoading" width="100%" height="146px" />
    <template v-else>
      <p v-if="hasenaError" class="card-message" role="status">하세나를 불러오지 못했습니다.</p>
      <NuxtLink to="/hasena" class="hasena-link" aria-label="하세나 페이지로 이동">
        <div class="hasena-thumbnail">
          <img v-if="thumbnail" :src="thumbnail" :alt="hasena?.title || '오늘의 하세나'" width="480" height="360" loading="lazy" />
          <span v-else class="hasena-fallback">오늘의 하세나</span>
        </div>
        <strong>{{ hasena?.title || '오늘의 하세나 보기' }}</strong>
        <span v-if="hasena" class="card-message">{{ hasena.passage }}</span>
      </NuxtLink>
    </template>
  </section>
  <section class="aside-card" aria-labelledby="home-group-title" :aria-busy="groupLoading">
    <h2 id="home-group-title"><UsersIcon :size="18" aria-hidden="true" />그룹 진도</h2>
    <Skeleton v-if="groupLoading" width="100%" height="64px" />
    <p v-else-if="groupError" class="card-message" role="status">그룹 진도를 불러오지 못했습니다.</p>
    <template v-else-if="group">
      <NuxtLink :to="`/groups/${group.id}`" class="group-link"><strong>{{ group.name }}</strong><ChevronRightIcon :size="18" aria-hidden="true" /></NuxtLink>
      <template v-if="groupProgress !== null">
        <p class="progress-label">오늘 멤버 완료율 <strong>{{ groupProgress }}%</strong></p>
        <progress :value="groupProgress" max="100" aria-label="오늘 그룹 멤버 완료율">{{ groupProgress }}%</progress>
      </template>
      <p v-else class="card-message">오늘 예정된 그룹 통독이 없어요.</p>
    </template>
    <NuxtLink v-else to="/groups" class="group-link">함께 읽을 그룹 찾아보기<ChevronRightIcon :size="18" aria-hidden="true" /></NuxtLink>
  </section>
  <AppButton v-if="hasenaError || groupError" variant="secondary" size="sm" @click="retry++">읽기 소식 다시 불러오기</AppButton>
</template>

<style scoped>
.aside-card { min-width: 0; padding: 18px 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); }
h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 15px; font-weight: 700; }
.hasena-link { display: flex; flex-direction: column; gap: 10px; }
.hasena-link, .group-link { color: var(--color-text-primary); font-size: 14px; text-decoration: none; border-radius: var(--radius-control); transition: transform var(--duration-micro) ease, background var(--duration-micro) ease; }
.hasena-link:hover { transform: translateY(-2px); }
.group-link:hover { background: var(--color-bg-hover); }
.hasena-link:active, .group-link:active { transform: scale(.97); }
.hasena-link:focus-visible, .group-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
.hasena-thumbnail { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; background: linear-gradient(160deg, var(--color-video-gradient-start), var(--color-video-gradient-end)); }
.hasena-thumbnail img { position: absolute; width: 100%; height: 100%; object-fit: cover; }
.hasena-fallback { z-index: 1; color: var(--color-on-image); font-size: 15px; font-weight: 600; }
.card-message { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
.aside-card > .card-message { margin-bottom: 10px; }
.group-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: var(--hit-min); }
.group-link svg { flex-shrink: 0; }
.progress-label { display: flex; justify-content: space-between; gap: 8px; margin: 12px 0 8px; color: var(--color-text-secondary); font-size: 12px; }
.progress-label strong { color: var(--color-accent-primary); font-variant-numeric: tabular-nums; }
progress { display: block; appearance: none; width: 100%; height: 8px; overflow: hidden; border: 0; border-radius: var(--radius-pill); background: var(--color-bg-hover); color: var(--color-accent-primary); }
progress::-webkit-progress-bar { background: var(--color-bg-hover); }
progress::-webkit-progress-value { border-radius: var(--radius-pill); background: var(--color-accent-primary); }
progress::-moz-progress-bar { border-radius: var(--radius-pill); background: var(--color-accent-primary); }
@media (prefers-reduced-motion: reduce) {
  .hasena-link, .group-link { transition: none; }
  .hasena-link:hover, .hasena-link:active, .group-link:active { transform: none; }
}
</style>
