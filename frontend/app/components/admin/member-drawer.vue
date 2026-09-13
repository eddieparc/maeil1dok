<script setup lang="ts">
import { computed, useId } from 'vue'
import { ChevronDown, Link2, ShieldAlert } from '@lucide/vue'
import BottomSheet from '~/components/ui/BottomSheet.vue'
import AppButton from '~/components/ui/AppButton.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import { memberActionLabels, memberDate, memberStatus, type MemberAction, type MemberConsoleState } from '~/composables/useAdminMembers'

const props = defineProps<{ state: MemberConsoleState }>()
const tabId = useId()
const tabs = [{ id: 'overview', label: '개요' }, { id: 'actions', label: '계정 작업' }, { id: 'settings', label: '설정' }, { id: 'activity', label: '활동 로그' }] as const
const accountActions = computed(() => {
  const member = props.state.detail
  if (!member) return []
  return [
    { action: member.email_verified ? 'unverify_email' : 'verify_email', description: '이메일 인증 상태를 변경하고 기존 인증 링크를 만료해요.' },
    { action: 'resend_verification', description: '미인증 회원에게 30분 동안 유효한 인증 메일을 보내요.' },
    { action: 'send_password_reset', description: member.has_password ? '비밀번호를 재설정할 수 있는 메일을 보내요.' : '소셜 전용 계정이에요. 인증된 이메일이 있어야 재설정 메일을 보낼 수 있어요.' },
    { action: 'revoke_sessions', description: '모든 기기의 세션을 만료해요. 다시 로그인해야 해요.' },
    { action: member.is_staff ? 'revoke_staff' : 'grant_staff', description: '관리자 콘솔 접근 권한을 변경해요. 감사 로그에 남아요.' },
    { action: member.is_dormant || member.status === 'dormant' ? 'clear_dormant' : 'set_dormant', description: '휴면 중 알림을 중단하고 리더보드에서 제외해요. 개인 설정은 유지해요.' },
    { action: member.is_active ? 'deactivate' : 'activate', description: '로그인 가능 상태를 변경해요. 기존 기록은 유지해요.', danger: true },
    { action: member.scheduled_deletion_at ? 'cancel_deletion' : 'schedule_deletion', description: member.scheduled_deletion_at ? `${memberDate(member.scheduled_deletion_at, true)} 삭제 예정. 복원 가능 기한 내에 취소할 수 있어요.` : '즉시 비활성화하고 14일 후 계정을 삭제하도록 예약해요.', danger: true },
  ] satisfies { action: MemberAction['action']; description: string; danger?: boolean }[]
})
function tabKey(event: KeyboardEvent, index: number) {
  const target = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
  if (target < 0) return
  event.preventDefault()
  const tab = tabs[target]
  if (tab) { props.state.setTab(tab.id); document.getElementById(`${tabId}-${tab.id}`)?.focus() }
}
const yesNo = (value: boolean) => value ? '켜짐' : '꺼짐'
</script>

<template>
  <BottomSheet :model-value="state.memberId !== null" class="member-drawer" :title="state.detail ? `${state.detail.nickname} · 회원 상세` : '회원 상세'" @update:model-value="value => { if (!value) state.closeMember() }">
    <div class="member-drawer-content">
      <div v-if="state.detailLoading" class="drawer-loading" role="status" aria-label="회원 상세 불러오는 중"><Skeleton v-for="index in 6" :key="index" :height="56" /></div>
      <div v-else-if="state.detailError" class="drawer-error" role="alert">{{ state.detailError }}<AppButton data-action="retry-detail" variant="secondary" @click="state.loadDetail">다시 시도</AppButton></div>
      <template v-else-if="state.detail">
        <header class="drawer-profile" :data-member-detail="state.detail.id">
          <span class="drawer-avatar" aria-hidden="true">{{ state.detail.nickname.slice(0, 1) }}</span>
          <div><strong>{{ state.detail.nickname }}</strong><span v-if="state.detail.is_staff" class="drawer-badge">STAFF</span><span class="drawer-badge" :data-status="state.detail.status">{{ memberStatus[state.detail.status] }}</span><p>#{{ state.detail.id }} · {{ state.detail.email || '이메일 없음' }}<br />가입 {{ memberDate(state.detail.joined_at) }}</p></div>
        </header>
        <div class="drawer-tabs" role="tablist" aria-label="회원 상세 탭">
          <button v-for="(item, index) in tabs" :id="`${tabId}-${item.id}`" :key="item.id" :data-action="`tab-${item.id}`" type="button" role="tab" :aria-selected="state.tab === item.id" :aria-controls="`${tabId}-panel`" :tabindex="state.tab === item.id ? 0 : -1" @click="state.setTab(item.id)" @keydown="tabKey($event, index)">{{ item.label }}</button>
        </div>
        <p v-if="state.busy" role="status" class="drawer-pending">서버에서 처리하고 있어요…</p>
        <p v-if="state.actionError" data-action-error role="alert" class="drawer-error">{{ state.actionError }}</p>
        <section :id="`${tabId}-panel`" role="tabpanel" :aria-labelledby="`${tabId}-${state.tab}`" tabindex="0">
          <template v-if="state.tab === 'overview'">
            <div class="drawer-stats"><div><strong>{{ state.detail.total_completed_days }}</strong><span>총 완료</span></div><div><strong>{{ state.detail.current_streak }}</strong><span>현재 연속</span></div><div><strong>{{ state.detail.longest_streak }}</strong><span>최장 연속</span></div></div>
            <h3>계정</h3>
            <dl class="drawer-facts">
              <div><dt>이메일 인증</dt><dd :data-email-verified="state.detail.email_verified">{{ state.detail.email_verified ? '인증됨' : '미인증' }}</dd></div>
              <div><dt>비밀번호</dt><dd>{{ state.detail.has_password ? '설정됨' : '소셜 전용' }}</dd></div>
              <div><dt>프로필 공개</dt><dd>{{ state.detail.is_public ? '공개' : '비공개' }}</dd></div>
              <div><dt>토큰 버전</dt><dd data-token-version>v{{ state.detail.token_version }}</dd></div>
              <div><dt>마지막 활동</dt><dd>{{ memberDate(state.detail.last_active_at, true) }}</dd></div>
              <div><dt>삭제 예약</dt><dd>{{ state.detail.scheduled_deletion_at ? memberDate(state.detail.scheduled_deletion_at, true) : '없음' }}</dd></div>
            </dl>
            <h3><Link2 :size="18" aria-hidden="true" />연결된 로그인</h3>
            <p v-if="state.detail.has_password" class="drawer-caption">이메일 · 비밀번호 로그인 사용 가능</p>
            <p v-if="!state.detail.social_accounts.length" class="drawer-caption">연결된 소셜 로그인이 없어요.</p>
            <article v-for="provider in state.detail.social_accounts" :key="provider.provider" class="drawer-provider" :data-social="provider.provider">
              <div><strong>{{ provider.provider }}</strong><code>{{ provider.provider_id }}</code><small>연결 {{ memberDate(provider.created_at) }}</small></div>
              <AppButton :data-action="`unlink-${provider.provider}`" variant="secondary" :disabled="state.busy" @click="state.act({ action: 'unlink_social', provider: provider.provider })">연결 해제</AppButton>
            </article>
            <p class="drawer-caption">마지막 로그인 수단은 해제할 수 없어요. 서버에서 현재 로그인 수단을 확인해요.</p>
            <h3>구독 플랜</h3>
            <p v-if="!state.detail.subscriptions.length" class="drawer-caption">구독 중인 플랜이 없어요.</p>
            <article v-for="subscription in state.detail.subscriptions" :key="subscription.id" class="drawer-subscription" :data-subscription="subscription.id">
              <div><strong>{{ subscription.name }}</strong><span v-if="subscription.is_default" class="drawer-badge">기본</span><span v-if="subscription.is_hidden" class="drawer-badge">숨김</span><span v-if="!subscription.is_active" class="drawer-badge">비활성</span></div>
              <progress :value="subscription.percent" max="100" :aria-label="`${subscription.name} 진도`" /><small>{{ subscription.completed_days }} / {{ subscription.total_days }}일 · {{ subscription.percent }}%</small>
            </article>
          </template>
          <template v-else-if="state.tab === 'actions'">
            <p class="drawer-caption"><ShieldAlert :size="16" aria-hidden="true" />모든 작업은 서버에서 확인하며 감사 로그에 남아요.</p>
            <article v-for="item in accountActions" :key="item.action" class="drawer-action">
              <div><h3>{{ memberActionLabels[item.action] }}</h3><p>{{ item.description }}</p></div>
              <AppButton :data-action="item.action" :variant="item.danger ? 'danger' : 'secondary'" :disabled="state.busy" @click="state.act({ action: item.action })">{{ memberActionLabels[item.action] }}</AppButton>
            </article>
          </template>
          <template v-else-if="state.tab === 'settings'">
            <p class="drawer-caption">회원의 설정은 본인만 변경할 수 있어요.</p>
            <h3>읽기 설정</h3>
            <dl class="drawer-facts" data-readonly-settings>
              <div><dt>테마</dt><dd>{{ state.detail.reading_settings.theme }}</dd></div>
              <div><dt>글꼴 / 크기</dt><dd>{{ state.detail.reading_settings.font_family }} / {{ state.detail.reading_settings.font_size }}px</dd></div>
              <div><dt>글자 두께 / 정렬</dt><dd>{{ state.detail.reading_settings.font_weight }} / {{ state.detail.reading_settings.text_align }}</dd></div>
              <div><dt>줄 간격</dt><dd>{{ state.detail.reading_settings.line_height }}</dd></div>
              <div><dt>인명 강조</dt><dd>{{ yesNo(state.detail.reading_settings.highlight_names) }}</dd></div>
              <div><dt>통독 자동 완료</dt><dd>{{ yesNo(state.detail.reading_settings.tongdok_auto_complete) }}</dd></div>
              <div><dt>절 연결</dt><dd>{{ yesNo(state.detail.reading_settings.verse_joining) }}</dd></div>
              <div><dt>절 번호</dt><dd>{{ yesNo(state.detail.reading_settings.show_verse_numbers) }}</dd></div>
              <div><dt>시편 머리말</dt><dd>{{ yesNo(state.detail.reading_settings.show_description) }}</dd></div>
              <div><dt>교차 참조</dt><dd>{{ yesNo(state.detail.reading_settings.show_cross_ref) }}</dd></div>
              <div><dt>각주</dt><dd>{{ yesNo(state.detail.reading_settings.show_footnotes) }}</dd></div>
            </dl>
            <h3>알림 설정</h3>
            <dl class="drawer-facts">
              <div><dt>전체 알림</dt><dd>{{ yesNo(state.detail.notification_settings.notifications_enabled) }}</dd></div>
              <div><dt>오늘 본문 알림</dt><dd>{{ yesNo(state.detail.notification_settings.reading_reminders_enabled) }} · {{ state.detail.notification_settings.reading_reminder_time }}</dd></div>
              <div><dt>하세나 알림</dt><dd>{{ yesNo(state.detail.notification_settings.hasena_reminders_enabled) }} · {{ state.detail.notification_settings.hasena_reminder_time }}</dd></div>
              <div><dt>시간대</dt><dd>{{ state.detail.notification_settings.timezone }}</dd></div>
              <div><dt>친구 활동</dt><dd>{{ yesNo(state.detail.notification_settings.friend_activity_enabled) }}</dd></div>
              <div><dt>주간 요약</dt><dd>{{ yesNo(state.detail.notification_settings.weekly_summary_enabled) }}</dd></div>
              <div><dt>서비스 공지</dt><dd>{{ yesNo(state.detail.notification_settings.service_notice_enabled) }}</dd></div>
            </dl>
          </template>
          <template v-else>
            <p class="drawer-caption">보관된 활동 기록과 관리자 작업을 보여줘요. 삭제·덮어쓴 기록과 전체 로그인 이력은 확인할 수 없어요.</p>
            <ol v-if="state.activity?.results.length" class="drawer-activity">
              <li v-for="item in state.activity.results" :key="`${item.kind}-${item.source_id}`" :data-activity="`${item.kind}-${item.source_id}`"><time :datetime="item.at">{{ memberDate(item.at, true) }}</time><span class="drawer-badge" :data-kind="item.kind">{{ item.kind }}</span><p>{{ item.text }}</p></li>
            </ol>
            <p v-else-if="state.activity && !state.activityLoading">보관된 활동 기록이 없어요.</p>
            <div v-if="state.activityLoading" class="drawer-loading" role="status" aria-label="활동 기록 불러오는 중"><Skeleton v-for="index in 3" :key="index" :height="56" /></div>
            <div v-if="state.activityError" class="drawer-error" role="alert">{{ state.activityError }}<AppButton data-action="retry-activity" variant="secondary" :disabled="state.activityLoading" @click="state.loadActivity(state.activity?.next ?? 1)">다시 시도</AppButton></div>
            <AppButton v-else-if="state.activity?.next" data-action="more-activity" variant="secondary" :loading="state.activityLoading" @click="state.loadActivity(state.activity.next)"><ChevronDown :size="18" aria-hidden="true" />더 보기</AppButton>
            <p v-if="state.activity" class="drawer-caption">{{ state.activity.results.length }} / {{ state.activity.count }}건</p>
          </template>
        </section>
      </template>
    </div>
  </BottomSheet>
</template>

<style scoped>
/* BottomSheet owns focus, Escape, scroll lock and modal stacking. Only geometry
   is specialized; the shared overlay and modal ownership remain unchanged. */
:global(.bottom-sheet.member-drawer) { margin-left: auto; width: 100%; max-width: 520px; height: 100dvh; max-height: 100dvh; border-radius: 0; padding-inline: 24px; }
.member-drawer-content { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.drawer-profile { display: flex; align-items: center; gap: 12px; padding-bottom: 20px; }
.drawer-profile strong { font-size: 20px; font-weight: 700; margin-right: 8px; }
.drawer-profile p { margin: 4px 0 0; color: var(--color-text-secondary); font-size: 12px; }
.drawer-avatar { display: grid; place-items: center; flex: 0 0 52px; height: 52px; border-radius: var(--radius-pill); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 22px; font-weight: 700; }
.drawer-badge { display: inline-flex; padding: 2px 6px; margin-right: 4px; border-radius: 6px; font-size: 10px; font-weight: 600; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.drawer-badge[data-status="active"] { background: var(--color-accent-bg); color: var(--color-accent-primary); }
.drawer-badge[data-status="dormant"] { background: var(--color-warning-bg); color: var(--color-warning-text); }
.drawer-badge[data-status="deletion"] { background: var(--color-error-bg); color: var(--color-error); }
.drawer-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: var(--radius-control); background: var(--color-bg-secondary); margin-bottom: 20px; }
.drawer-tabs button { min-width: var(--hit-min); min-height: var(--hit-min); padding: 4px; background: transparent; border: 1px solid transparent; border-radius: var(--radius-control); color: var(--color-text-secondary); font: inherit; cursor: pointer; }
.drawer-tabs button[aria-selected="true"] { color: var(--color-accent-primary); background: var(--color-bg-card); border-color: var(--color-border-default); font-weight: 700; }
.drawer-tabs button:focus-visible, [role="tabpanel"]:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.drawer-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-block: 16px 24px; }
.drawer-stats > div { display: flex; flex-direction: column; text-align: center; gap: 4px; padding: 16px 8px; background: var(--color-bg-secondary); border-radius: var(--radius-control); }
.drawer-stats strong { font-size: 24px; }
.drawer-stats span { font-size: 11px; color: var(--color-text-secondary); }
h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 24px 0 12px; }
.drawer-facts { margin: 0; }
.drawer-facts > div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; padding-block: 10px; border-bottom: 1px solid var(--color-border-light); }
.drawer-facts dt { color: var(--color-text-secondary); }
.drawer-facts dd { margin: 0; text-align: right; }
.drawer-provider, .drawer-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 16px; border-bottom: 1px solid var(--color-border-light); }
.drawer-provider > div, .drawer-action > div { min-width: 0; }
.drawer-provider code, .drawer-provider small { display: block; color: var(--color-text-secondary); font-size: 11px; }
.drawer-provider code, .drawer-activity time { font-family: ui-monospace, SFMono-Regular, monospace; }
.drawer-provider :deep(button), .drawer-action :deep(button) { flex-shrink: 0; }
.drawer-caption, .drawer-action p { color: var(--color-text-secondary); font-size: 12px; margin: 8px 0; }
.drawer-caption svg { vertical-align: middle; margin-right: 4px; }
.drawer-action h3 { margin: 0; }
.drawer-action p { margin-bottom: 0; }
.drawer-subscription { padding: 12px 0; }
.drawer-subscription strong { margin-right: 8px; }
.drawer-subscription progress { display: block; width: 100%; height: 3px; accent-color: var(--color-accent-primary); margin: 12px 0 4px; }
.drawer-subscription small { color: var(--color-text-secondary); }
.drawer-activity { list-style: none; padding: 0; }
.drawer-activity li { padding: 12px 0; border-bottom: 1px solid var(--color-border-light); }
.drawer-activity time { font-size: 12px; color: var(--color-text-secondary); margin-right: 8px; }
.drawer-activity p { margin: 8px 0 0; }
.drawer-badge[data-kind="login"] { background: var(--color-info-bg); color: var(--color-info-text); }
.drawer-badge[data-kind="signup"] { background: var(--color-warning-bg); color: var(--color-warning-text); }
.drawer-loading { display: grid; gap: 12px; }
.drawer-error { color: var(--color-error); padding-block: 12px; }
.drawer-pending { color: var(--color-accent-primary); }
@media (max-width: 1023px) {
  :global(.bottom-sheet.member-drawer) { max-width: none; padding-inline: 16px; }
  .drawer-action { align-items: flex-start; flex-direction: column; }
  .drawer-action :deep(button) { align-self: flex-end; }
  .drawer-facts > div { grid-template-columns: 105px minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .drawer-tabs button { transition: none; } }
</style>
