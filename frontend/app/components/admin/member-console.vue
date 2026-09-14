<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Check, ChevronLeft, ChevronRight, Search, Users, Activity, MailWarning, CalendarClock } from '@lucide/vue'
import { useAdminMembers, memberDate, memberStatus, memberError, type MemberQuery } from '~/composables/useAdminMembers'
import MemberDrawer from './member-drawer.vue'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'

const state = reactive(useAdminMembers())
defineExpose({ state })
const searchInput = ref('')
const filters: { value: MemberQuery['filter']; label: string }[] = [{ value: 'all', label: '전체' }, { value: 'unverified', label: '미인증' }, { value: 'staff', label: 'STAFF' }, { value: 'dormant', label: '휴면·비활성' }, { value: 'deletion', label: '삭제 예약' }]
const sorts: { value: MemberQuery['sort']; label: string }[] = [{ value: 'recent', label: '최근 가입' }, { value: 'joined', label: '오래된 순' }, { value: 'streak', label: '연속 순' }]
const statCards = [{ key: 'total', label: '전체 회원', icon: Users }, { key: 'weekly_active', label: '주간 활성', icon: Activity }, { key: 'unverified', label: '이메일 미인증', icon: MailWarning }, { key: 'scheduled_deletion', label: '삭제 예약', icon: CalendarClock }] as const
</script>

<template>
  <section class="member-console" aria-label="회원 관리">
    <div class="member-stats" :aria-busy="state.statsLoading">
      <article v-for="card in statCards" :key="card.key" class="member-stat">
        <span class="stat-title"><component :is="card.icon" :size="18" aria-hidden="true" />{{ card.label }}</span>
        <Skeleton v-if="state.statsLoading" :height="28" width="60%" />
        <template v-else-if="state.stats">
          <strong :data-stat="card.key">{{ state.stats[card.key].toLocaleString('ko-KR') }}</strong>
          <span v-if="state.stats.deltas[card.key] === null" data-stat-delta="unavailable" :title="state.stats.deltas_unavailable_reason">이전 기록이 없어 증감 확인 불가</span>
          <span v-else data-stat-delta="available">{{ state.stats.deltas[card.key] }}</span>
        </template>
        <span v-else>확인 불가</span>
      </article>
    </div>
    <div v-if="state.statsError" class="member-error" role="alert">{{ state.statsError }}<AppButton data-action="retry-stats" variant="ghost" :disabled="state.statsLoading" @click="state.loadStats">통계 다시 시도</AppButton></div>

    <div class="member-filters">
      <form class="member-search" role="search" @submit.prevent="state.search({ q: searchInput.trim() })">
        <Search :size="18" aria-hidden="true" />
        <input v-model="searchInput" data-action="search-input" type="search" aria-label="닉네임, 이메일 또는 ID 검색" placeholder="닉네임 · 이메일 · ID 검색" :disabled="state.busy" />
        <AppButton data-action="search" type="submit" variant="ghost" :disabled="state.busy">검색</AppButton>
      </form>
      <div class="member-segments" role="group" aria-label="회원 필터">
        <button v-for="filter in filters" :key="filter.value" type="button" :data-action="`filter-${filter.value}`" :aria-pressed="state.query.filter === filter.value" :disabled="state.busy" @click="state.search({ filter: filter.value })">{{ filter.label }}</button>
      </div>
      <div class="member-segments member-sorts" role="group" aria-label="회원 정렬">
        <button v-for="sort in sorts" :key="sort.value" type="button" :data-action="`sort-${sort.value}`" :aria-pressed="state.query.sort === sort.value" :disabled="state.busy" @click="state.search({ sort: sort.value })">{{ sort.label }}</button>
      </div>
    </div>
    <div v-if="state.selected.length" class="member-bulk" aria-label="선택 회원 일괄 작업" :aria-busy="state.busy">
      <strong>{{ state.selected.length }}명 선택</strong>
      <AppButton data-action="bulk-resend_verification" variant="secondary" :disabled="state.busy || state.listLoading" @click="state.bulk('resend_verification')">인증 메일 재발송</AppButton>
      <AppButton data-action="bulk-revoke_sessions" variant="secondary" :disabled="state.busy || state.listLoading" @click="state.bulk('revoke_sessions')">세션 만료</AppButton>
      <AppButton data-action="bulk-deactivate" variant="danger" :disabled="state.busy || state.listLoading" @click="state.bulk('deactivate')">비활성화</AppButton>
      <AppButton data-action="clear-selection" variant="ghost" :disabled="state.busy" @click="state.selected = []">선택 해제</AppButton>
    </div>
    <ul v-if="state.bulkResults.length" class="member-results" role="status">
      <li v-for="result in state.bulkResults" :key="result.id" :data-bulk-result="result.id" :data-success="result.success">#{{ result.id }} · {{ result.success ? '처리 완료' : memberError(result.error) }}</li>
    </ul>
    <p v-if="state.actionError && state.memberId === null" class="member-error" role="alert">{{ state.actionError }}</p>
    <div v-if="state.listLoading" class="member-loading" role="status" aria-label="회원 목록 불러오는 중">
      <Skeleton v-for="index in 10" :key="index" :height="64" />
    </div>
    <div v-else-if="state.listError" class="member-empty member-error" role="alert">{{ state.listError }}<AppButton data-action="retry-list" variant="secondary" @click="state.loadList">다시 시도</AppButton></div>
    <p v-else-if="state.list && !state.list.results.length" class="member-empty" role="status">조건에 맞는 회원이 없어요.</p>
    <div v-else-if="state.list" class="member-table" role="table" aria-label="회원 목록">
      <div class="member-row member-table-heading" role="row">
        <span role="columnheader"><button type="button" class="member-check" data-action="select-page" role="checkbox" :aria-checked="state.allSelected ? true : state.selected.length ? 'mixed' : false" aria-label="현재 페이지 회원 전체 선택" :disabled="state.busy" @click="state.togglePage"><span :class="{ checked: state.allSelected }"><Check v-if="state.allSelected" :size="14" aria-hidden="true" /></span></button></span>
        <span role="columnheader">회원</span><span role="columnheader">이메일 · 로그인</span><span role="columnheader">가입일</span><span role="columnheader">마지막 활동</span><span role="columnheader">플랜 · 진도</span><span role="columnheader">연속</span><span role="columnheader">상태</span>
      </div>
      <div v-for="row in state.list.results" :key="row.id" class="member-row" role="row" :data-member-row="row.id" @click="state.openMember(row.id)">
        <div role="cell"><button type="button" class="member-check" :data-action="`select-${row.id}`" role="checkbox" :aria-checked="state.selected.includes(row.id)" :aria-label="`${row.nickname} 선택`" :disabled="state.busy" @click.stop="state.toggle(row.id)"><span :class="{ checked: state.selected.includes(row.id) }"><Check v-if="state.selected.includes(row.id)" :size="14" aria-hidden="true" /></span></button></div>
        <div role="cell"><button class="member-identity" type="button" :data-action="`open-${row.id}`" @click.stop="state.openMember(row.id)"><span class="member-avatar" :class="{ staff: row.is_staff }" aria-hidden="true">{{ row.nickname.slice(0, 1) }}</span><span><strong>{{ row.nickname }} <span v-if="row.is_staff" class="member-badge">STAFF</span></strong><small class="member-mono">#{{ row.id }}</small></span></button></div>
        <div role="cell" class="member-login"><span class="member-email">{{ row.email || '이메일 없음' }} <Check v-if="row.email_verified" :size="14" aria-label="인증됨" /><span v-else class="member-badge warning">미인증</span></span><span class="member-providers"><span v-for="provider in row.providers" :key="provider" class="member-badge" :data-provider="provider">{{ provider === 'email' ? '이메일' : provider }}</span></span></div>
        <div role="cell" class="member-date"><span class="mobile-label">가입일 </span>{{ memberDate(row.joined_at) }}</div>
        <div role="cell" class="member-date"><span class="mobile-label">마지막 활동 </span>{{ memberDate(row.last_active_at) }}</div>
        <div role="cell" class="member-plan"><template v-if="row.plan"><span>{{ row.plan.name }}</span><progress :value="row.plan.percent" max="100" :aria-label="`${row.plan.name} 진도`" /><small>{{ row.plan.percent }}%</small></template><span v-else>구독 플랜 없음</span></div>
        <div role="cell"><span class="mobile-label">연속 </span>{{ row.current_streak ? `${row.current_streak}일` : '—' }}</div>
        <div role="cell"><span class="member-badge" :data-status="row.status">{{ memberStatus[row.status] }}</span></div>
      </div>
    </div>
    <nav v-if="state.list" class="member-pagination" aria-label="회원 목록 페이지">
      <span>{{ state.list.count ? ((state.query.page ?? 1) - 1) * 50 + 1 : 0 }}–{{ ((state.query.page ?? 1) - 1) * 50 + state.list.results.length }} / {{ state.list.count.toLocaleString('ko-KR') }}</span>
      <AppButton data-action="previous-page" variant="ghost" :disabled="state.busy || state.listLoading || !state.list.previous" @click="state.search({ page: state.list.previous ?? 1 })"><ChevronLeft :size="18" aria-hidden="true" />이전</AppButton>
      <AppButton data-action="next-page" variant="ghost" :disabled="state.busy || state.listLoading || !state.list.next" @click="state.search({ page: state.list.next ?? 1 })">다음<ChevronRight :size="18" aria-hidden="true" /></AppButton>
    </nav>
    <MemberDrawer :state="state" />
  </section>
</template>

<style scoped>
.member-console { min-width: 0; font-size: 13px; }
.member-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.member-stat { display: flex; flex-direction: column; gap: 8px; padding: 20px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); }
.stat-title { display: flex; align-items: center; gap: 8px; color: var(--color-text-secondary); }
.member-stat strong { font-size: 28px; font-weight: 700; }
.member-stat > span:last-child { font-size: 11px; color: var(--color-text-secondary); }
.member-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.member-search { display: flex; align-items: center; gap: 8px; padding-left: 12px; flex: 1 1 260px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-bg-card); }
.member-search input { width: 100%; min-width: 0; min-height: var(--hit-min); background: transparent; border: 0; color: var(--color-text-primary); font: inherit; }
.member-search:focus-within { outline: 3px solid var(--color-accent-focus-ring); }
.member-search input:focus { outline: none; }
.member-segments { display: flex; flex-wrap: wrap; gap: 4px; }
.member-segments button { min-height: var(--hit-min); min-width: var(--hit-min); padding: 0 12px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-control); color: var(--color-text-secondary); font: inherit; cursor: pointer; }
.member-segments button[aria-pressed="true"] { color: var(--color-accent-primary); border-color: var(--color-accent-primary); background: var(--color-accent-bg); font-weight: 700; }
.member-sorts { margin-left: auto; }
.member-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; margin-bottom: 16px; border-radius: var(--radius-control); background: var(--color-accent-bg); }
.member-bulk strong { margin-right: auto; }
.member-table { border: 1px solid var(--color-border-default); border-radius: var(--radius-card); overflow: hidden; background: var(--color-bg-card); }
.member-row { display: grid; grid-template-columns: 44px minmax(100px, 1.4fr) minmax(120px, 1.6fr) 90px 90px 100px 60px 80px; gap: 8px; align-items: center; padding: 12px; border-bottom: 1px solid var(--color-border-light); cursor: pointer; }
.member-row:last-child { border-bottom: 0; }
.member-row:not(.member-table-heading):hover { background: var(--color-bg-hover); }
.member-table-heading { padding-block: 0; color: var(--color-text-secondary); font-size: 12px; background: var(--color-bg-secondary); cursor: default; }
.member-check { display: grid; place-items: center; width: var(--hit-min); height: var(--hit-min); padding: 0; border: 0; background: transparent; cursor: pointer; }
.member-check > span { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid var(--color-border-default); border-radius: 4px; }
.member-check > .checked { background: var(--color-accent-primary); color: var(--color-text-inverse); border-color: var(--color-accent-primary); }
.member-identity { display: flex; align-items: center; text-align: left; gap: 8px; width: 100%; min-height: var(--hit-min); padding: 0; background: transparent; border: 0; font: inherit; color: inherit; cursor: pointer; }
.member-identity > span:last-child { min-width: 0; }
.member-identity strong { display: block; overflow-wrap: anywhere; font-weight: 700; }
.member-identity small { display: block; margin-top: 4px; color: var(--color-text-secondary); }
.member-avatar { display: grid; place-items: center; flex: 0 0 30px; height: 30px; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); }
.member-avatar.staff { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.member-mono, .member-date { font-variant-numeric: tabular-nums; }
.member-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
.member-date { font-size: 11px; color: var(--color-text-secondary); }
.member-login { min-width: 0; }
.member-email { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; overflow-wrap: anywhere; }
.member-email svg { color: var(--color-accent-primary); }
.member-providers { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.member-badge { display: inline-flex; align-items: center; padding: 3px 6px; border-radius: 6px; background: var(--color-bg-tertiary); font-size: 10px; font-weight: 600; }
.member-badge[data-provider="kakao"] { background: var(--color-kakao-bg); color: var(--color-kakao-text); }
.member-badge[data-provider="google"] { background: var(--color-info-bg); color: var(--color-info-text); }
.member-badge[data-provider="apple"] { background: var(--color-text-primary); color: var(--color-bg-primary); }
.member-badge[data-status="active"] { background: var(--color-accent-bg); color: var(--color-accent-primary); }
.member-badge[data-status="dormant"], .member-badge.warning { background: var(--color-warning-bg); color: var(--color-warning-text); }
.member-badge[data-status="deletion"] { background: var(--color-error-bg); color: var(--color-error); }
.member-plan { display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; font-size: 11px; }
.member-plan progress { width: 100%; height: 3px; accent-color: var(--color-accent-primary); }
.member-plan small { color: var(--color-text-secondary); }
.member-pagination { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.member-pagination > span { margin-right: auto; color: var(--color-text-secondary); }
.member-empty { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 40px 16px; background: var(--color-bg-card); border-radius: var(--radius-card); }
.member-loading { display: grid; gap: 8px; }
.member-error { color: var(--color-error); }
.member-results { padding: 16px 24px; background: var(--color-bg-card); border: 1px solid var(--color-border-default); border-radius: var(--radius-control); }
.member-results li { margin-block: 8px; }
.mobile-label { display: none; }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 1199px) { .member-row { grid-template-columns: 44px minmax(90px, 1.4fr) minmax(110px, 1.6fr) 76px 76px 80px 44px 65px; gap: 4px; padding-inline: 8px; } }
@media (max-width: 1023px) {
  .member-stats { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .member-stat { padding: 16px; }
  .member-table { border: 0; background: transparent; overflow: visible; }
  .member-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; margin-bottom: 12px; padding: 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); }
  .member-row > div:nth-child(n+3) { grid-column: 2; }
  .member-table-heading { grid-template-columns: 44px 1fr; border: 0; background: transparent; padding-block: 0; margin-bottom: 4px; }
  .member-table-heading > span:nth-child(n+3) { display: none; }
  .member-identity strong { font-size: 14px; }
  .member-date { font-size: 12px; }
  .mobile-label { display: inline; color: var(--color-text-secondary); }
  .member-sorts { margin-left: 0; }
  .member-plan { max-width: 280px; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>
