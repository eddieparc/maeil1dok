import { computed, onMounted, onScopeDispose, ref, type UnwrapNestedRefs } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import { useToast } from '~/composables/useToast'
import type { components, operations } from '~/types/generated/api-schema'

type Schema = components['schemas']
export type MemberQuery = NonNullable<operations['admin_members_list']['parameters']['query']>
export type MemberAction = Schema['MemberAction']
export type MemberBulkAction = Schema['MemberBulk']['action']
export const memberStatus: Record<Schema['MemberStatusEnum'], string> = { active: '활성', dormant: '휴면', inactive: '비활성', deletion: '삭제 예약' }
export const memberActionLabels: Record<MemberAction['action'], string> = {
  verify_email: '이메일 인증 처리', unverify_email: '이메일 인증 해제', resend_verification: '인증 메일 재발송', send_password_reset: '비밀번호 재설정 메일',
  revoke_sessions: '모든 세션 만료', grant_staff: 'STAFF 권한 부여', revoke_staff: 'STAFF 권한 해제', set_dormant: '휴면 처리', clear_dormant: '휴면 해제',
  deactivate: '계정 비활성화', activate: '계정 활성화', schedule_deletion: '계정 삭제 예약', cancel_deletion: '삭제 예약 취소', unlink_social: '연결 해제',
}
const rejectionMessages: Record<string, string> = {
  last_login_method: '마지막 로그인 수단은 해제할 수 없어요.', provider_not_linked: '이미 해제된 로그인 수단이에요.', email_required: '이메일이 없는 계정이에요.',
  account_not_active: '활성 상태의 계정에서만 메일을 보낼 수 있어요.', already_verified: '이미 인증된 이메일이에요.', social_only_unverified: '미인증 소셜 전용 계정은 먼저 이메일 인증이 필요해요.',
  mail_delivery_failed: '메일 전송에 실패했어요. 계정 상태를 확인한 뒤 다시 시도해주세요.', merged_account: '병합된 계정은 복원할 수 없어요.', cancel_deletion_first: '삭제 예약을 먼저 취소해주세요.',
  already_scheduled: '이미 삭제가 예약된 계정이에요.', account_not_restorable: '삭제 예약이 없거나 복원 기한이 지났어요.', identity_conflict: '동일한 이메일의 활성 계정이 있어 복원할 수 없어요.', member_not_found: '회원을 찾을 수 없어요.',
}
export function memberError(code: string | null): string { return (code && rejectionMessages[code]) || '처리 결과를 확인하지 못했어요. 새로고침으로 상태를 확인한 뒤 다시 시도해주세요.' }
export function memberDate(value: string | null, time = false): string {
  if (!value) return '기록 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(new Date(value))
}
const isDanger = (action: MemberAction['action']) => ['deactivate', 'activate', 'schedule_deletion', 'cancel_deletion'].includes(action)

export function useAdminMembers() {
  const api = useApi(), auth = useAuthService(), modal = useModal(), toast = useToast()
  const query = ref<MemberQuery>({ q: '', filter: 'all', sort: 'recent', page: 1 })
  const list = ref<Schema['MemberList'] | null>(null), stats = ref<Schema['MemberStats'] | null>(null)
  const selected = ref<number[]>([]), listLoading = ref(false), statsLoading = ref(false), listError = ref(''), statsError = ref('')
  const memberId = ref<number | null>(null), detail = ref<Schema['MemberDetail'] | null>(null), detailLoading = ref(false), detailError = ref('')
  const tab = ref<'overview' | 'actions' | 'settings' | 'activity'>('overview')
  const activity = ref<Schema['MemberActivity'] | null>(null), activityLoading = ref(false), activityError = ref('')
  const busy = ref(false), exporting = ref(false), actionError = ref(''), bulkResults = ref<Schema['MemberActionResult'][]>([])
  let alive = true, listEpoch = 0, statsEpoch = 0, detailEpoch = 0, activityEpoch = 0
  let confirmationId: string | undefined
  const permitted = () => alive && auth.isInitialized.value && !auth.isLoading.value && !auth.isSessionUnknown.value && auth.isAuthenticated.value && auth.isStaff.value
  const allSelected = computed(() => !!list.value?.results.length && list.value.results.every(row => selected.value.includes(row.id)))
  async function failure(error: unknown): Promise<string> {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : null
    if (status === 401 || status === 403) {
      if (alive) await auth.revalidate()
      return '권한 또는 로그인 상태가 변경되었어요.'
    }
    if (status === 404) return memberError('member_not_found')
    const data = error && typeof error === 'object' && 'data' in error ? error.data : null
    const code = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null
    return memberError(code)
  }
  async function loadList() {
    if (!permitted()) return
    const epoch = ++listEpoch
    listLoading.value = true; listError.value = ''
    try {
      const { data } = await api.GET('/api/v1/admin/members/', { params: { ...query.value } })
      if (epoch !== listEpoch || !permitted()) return
      list.value = data
      selected.value = selected.value.filter(id => data.results.some(row => row.id === id))
    } catch (error) {
      const message = await failure(error)
      if (epoch === listEpoch && alive) { listError.value = message; list.value = null; selected.value = [] }
    } finally { if (epoch === listEpoch) listLoading.value = false }
  }
  async function loadStats() {
    if (!permitted()) return
    const epoch = ++statsEpoch
    statsLoading.value = true; statsError.value = ''
    try {
      const { data } = await api.GET('/api/v1/admin/members/stats/')
      if (epoch === statsEpoch && permitted()) stats.value = data
    } catch (error) {
      const message = await failure(error)
      if (epoch === statsEpoch && alive) { statsError.value = message; stats.value = null }
    } finally { if (epoch === statsEpoch) statsLoading.value = false }
  }
  async function search(next: MemberQuery) {
    if (busy.value || !permitted()) return
    query.value = { ...query.value, ...next, page: next.page ?? 1 }
    selected.value = []; bulkResults.value = []; list.value = null
    await loadList()
  }
  function toggle(id: number) {
    if (busy.value || listLoading.value || !list.value?.results.some(row => row.id === id)) return
    selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id]
  }
  function togglePage() {
    if (busy.value || listLoading.value) return
    selected.value = allSelected.value ? [] : (list.value?.results.map(row => row.id) ?? [])
  }
  async function loadDetail() {
    if (!permitted() || memberId.value === null) return
    const id = memberId.value, epoch = ++detailEpoch
    detailLoading.value = true; detailError.value = ''; detail.value = null
    try {
      const { data } = await api.GET(api.path('/api/v1/admin/members/{user_id}/', { user_id: id }))
      if (epoch === detailEpoch && memberId.value === id && permitted()) detail.value = data
    } catch (error) {
      const message = await failure(error)
      if (epoch === detailEpoch && alive) detailError.value = message
    } finally { if (epoch === detailEpoch) detailLoading.value = false }
  }
  async function openMember(id: number) {
    memberId.value = id; tab.value = 'overview'; actionError.value = ''; activity.value = null; activityError.value = ''; activityLoading.value = false; ++activityEpoch
    await loadDetail()
  }
  function closeMember() {
    memberId.value = null; detail.value = null; activity.value = null; actionError.value = ''; detailLoading.value = false; activityLoading.value = false
    ++detailEpoch; ++activityEpoch
  }
  async function loadActivity(page = 1) {
    if (!permitted() || memberId.value === null || activityLoading.value) return
    const id = memberId.value, epoch = ++activityEpoch
    activityLoading.value = true; activityError.value = ''
    try {
      const { data } = await api.GET(api.path('/api/v1/admin/members/{user_id}/activity/', { user_id: id }), { params: { page } })
      if (epoch === activityEpoch && memberId.value === id && permitted()) activity.value = { ...data, results: page === 1 ? data.results : [...(activity.value?.results ?? []), ...data.results] }
    } catch (error) {
      const message = await failure(error)
      if (epoch === activityEpoch && alive) activityError.value = message
    } finally { if (epoch === activityEpoch) activityLoading.value = false }
  }
  function setTab(value: typeof tab.value) { tab.value = value; if (value === 'activity' && !activity.value) void loadActivity() }
  async function confirm(action: MemberAction['action'], count = 1) {
    if (!isDanger(action)) return true
    const pending = modal.confirm({ title: memberActionLabels[action], description: `${count}명에게 적용해요. ${action === 'schedule_deletion' ? '즉시 로그인할 수 없으며 14일 후 삭제 예정이에요.' : '로그인 가능 상태가 변경되며 작업은 감사 로그에 남아요.'}`, confirmText: memberActionLabels[action], confirmVariant: 'danger', icon: 'warning' })
    confirmationId = modal.stack.value.at(-1)?.id
    try { return await pending } finally { confirmationId = undefined }
  }
  async function refreshAfterAction(id: number | null) {
    if (!permitted()) return
    if (id !== null && memberId.value === id) { activity.value = null; ++activityEpoch; activityLoading.value = false }
    await Promise.all([loadList(), loadStats(), ...(id !== null && memberId.value === id ? [loadDetail(), ...(tab.value === 'activity' ? [loadActivity()] : [])] : [])])
  }
  async function act(body: MemberAction) {
    if (busy.value || detailLoading.value || !detail.value || !permitted()) return
    busy.value = true; actionError.value = ''
    const id = detail.value.id, epoch = detailEpoch
    try {
      if (!await confirm(body.action) || !permitted() || memberId.value !== id || detailEpoch !== epoch) return
      ++listEpoch; ++statsEpoch; ++activityEpoch; activityLoading.value = false
      const result = await api.POST(api.path('/api/v1/admin/members/{user_id}/actions/', { user_id: id }), body)
      if (!alive) return
      if (!result.success) {
        const message = memberError(result.error)
        if (memberId.value === id) actionError.value = message
        toast.error(message)
      }
      else toast.success(`${memberActionLabels[body.action]} 완료`)
      await refreshAfterAction(id)
    } catch (error) {
      const message = await failure(error)
      if (alive) { if (memberId.value === id) actionError.value = message; toast.error(message); await refreshAfterAction(id) }
    } finally { busy.value = false }
  }
  async function bulk(action: MemberBulkAction) {
    if (busy.value || listLoading.value || !selected.value.length || !permitted()) return
    busy.value = true; actionError.value = ''; bulkResults.value = []
    const ids = [...selected.value]
    try {
      if (!await confirm(action, ids.length) || !permitted()) return
      const body: Schema['MemberBulk'] = { ids, action }
      ++listEpoch; ++statsEpoch
      const result = await api.POST('/api/v1/admin/members/bulk/', body)
      if (!alive) return
      bulkResults.value = result.results
      selected.value = result.results.filter(row => !row.success).map(row => row.id)
      const succeeded = result.results.filter(row => row.success).length
      const summary = `${succeeded}명 처리 완료 · ${result.results.length - succeeded}명 실패`
      if (succeeded === result.results.length) toast.success(summary)
      else toast.error(summary)
      await refreshAfterAction(memberId.value)
    } catch (error) {
      const message = await failure(error)
      if (alive) { actionError.value = message; toast.error(message); await refreshAfterAction(memberId.value) }
    } finally { busy.value = false }
  }
  async function exportCsv(masked = true) {
    if (exporting.value || !permitted()) return
    exporting.value = true
    try {
      const { q, filter, sort } = query.value
      const { data } = await api.GET('/api/v1/admin/members/export.csv', { params: { q, filter, sort, masked } })
      if (!permitted()) return
      if (typeof data !== 'string') throw new Error('CSV response unavailable')
      // Fetch text decoding consumes the server BOM; retain it in the download
      // so spreadsheet applications correctly decode Korean names.
      const url = URL.createObjectURL(new Blob([data.startsWith('\uFEFF') ? data : `\uFEFF${data}`], { type: 'text/csv;charset=utf-8' }))
      try {
        const link = document.createElement('a'); link.href = url; link.download = masked ? 'members-masked.csv' : 'members.csv'; document.body.appendChild(link); link.click(); link.remove()
      } finally { URL.revokeObjectURL(url) }
      toast.success('CSV 내보내기 완료')
    } catch (error) { toast.error(await failure(error)) } finally { exporting.value = false }
  }
  onMounted(() => { if (permitted()) { void loadList(); void loadStats() } })
  onScopeDispose(() => {
    alive = false; ++listEpoch; ++statsEpoch; ++detailEpoch; ++activityEpoch
    if (confirmationId) modal.cancel(confirmationId)
  })
  return { query, list, stats, selected, listLoading, statsLoading, listError, statsError, allSelected, memberId, detail, detailLoading, detailError, tab, activity, activityLoading, activityError, busy, exporting, actionError, bulkResults, loadList, loadStats, search, toggle, togglePage, openMember, closeMember, loadDetail, setTab, loadActivity, act, bulk, exportCsv }
}
export type MemberConsoleState = UnwrapNestedRefs<ReturnType<typeof useAdminMembers>>
