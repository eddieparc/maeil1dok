import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import type { components } from '~/types/generated/api-schema'

type Post = components['schemas']['GroupPostResponse']
type Failure = 'login' | 'denied' | 'missing' | 'error'

export function useGroupBoard(context: () => { groupId: number; member?: boolean }) {
  const api = useApi()
  const auth = useAuthService()
  const modal = useModal()
  const posts = ref<Post[]>([])
  const post = ref<Post | null>(null)
  const view = ref<'list' | 'detail' | 'create' | 'edit'>('list')
  const page = ref(1)
  const count = ref(0)
  const hasNext = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const failure = ref<Failure | null>(null)
  const message = ref('')
  const draft = reactive({ title: '', content: '' })
  const fields = reactive({ title: '', content: '' })
  const ready = ref(false)
  let disposed = false
  let generation = 0
  let readSequence = 0
  let detailId: number | null = null
  const owner = computed(() => [
    context().groupId, context().member, auth.user.value?.id,
    auth.isAuthenticated.value, auth.isInitialized.value, auth.isLoading.value,
    auth.isSessionUnknown.value,
  ].join(':'))
  const access = computed(() => {
    if (!ready.value || !auth.isInitialized.value || auth.isLoading.value) return 'loading'
    if (auth.isSessionUnknown.value) return 'offline'
    if (!auth.isAuthenticated.value) return 'login'
    if (context().member === false) return 'denied'
    return 'member'
  })
  const ticket = () => ({ generation, owner: owner.value })
  const current = (value: ReturnType<typeof ticket>) =>
    ready.value && value.generation === generation && value.owner === owner.value
  const listPath = () => api.path('/api/v1/todos/groups/{group_id}/posts/', { group_id: context().groupId })
  const detailPath = (id: number) => api.path('/api/v1/todos/groups/{group_id}/posts/{post_id}/', {
    group_id: context().groupId, post_id: id,
  })
  function clearError() {
    failure.value = null
    message.value = ''
    fields.title = ''
    fields.content = ''
  }
  function fail(error: unknown, detail: boolean) {
    const status = error instanceof Error && 'status' in error ? error.status : 0
    failure.value = status === 401 ? 'login' : status === 403 ? 'denied' : status === 404 ? 'missing' : 'error'
    message.value = status === 401 ? '로그인 후 게시판을 이용해 주세요.'
      : status === 403 ? '이 작업을 할 권한이 없어요.'
        : status === 404 ? (detail ? '게시글이 없거나 접근할 수 없어요.' : '게시판에 접근할 수 없거나 페이지가 없어요.')
          : '요청을 완료하지 못했어요. 다시 시도해 주세요.'
    if (error instanceof Error && 'data' in error && typeof error.data === 'object' && error.data !== null && 'errors' in error.data) {
      const errors = error.data.errors
      if (typeof errors === 'object' && errors !== null) {
        for (const field of ['title', 'content'] as const) {
          if (field in errors) {
            const value = Reflect.get(errors, field)
            if (Array.isArray(value) && value.every(item => typeof item === 'string')) fields[field] = value.join(' ')
          }
        }
      }
    }
    // A revoked session must not retain previously readable private content.
    if (status === 401 || status === 403 || status === 404) {
      posts.value = []
      post.value = null
    }
  }
  async function loadList(target = page.value) {
    if (access.value !== 'member' || saving.value) return
    const token = ticket()
    const sequence = ++readSequence
    loading.value = true
    clearError()
    view.value = 'list'
    detailId = null
    post.value = null
    page.value = Math.max(1, Math.floor(target))
    try {
      const { data } = await api.GET(listPath(), { params: { page: page.value, page_size: 20 } })
      if (!current(token) || sequence !== readSequence) return
      if (!data.success) throw new Error('Board list rejected')
      posts.value = data.posts
      count.value = data.count
      hasNext.value = data.next !== null && page.value < Math.ceil(data.count / 20)
    } catch (error) {
      if (current(token) && sequence === readSequence) fail(error, false)
    } finally {
      if (current(token) && sequence === readSequence) loading.value = false
    }
  }
  async function open(id: number) {
    if (access.value !== 'member' || saving.value) return
    const token = ticket()
    const sequence = ++readSequence
    detailId = id
    view.value = 'detail'
    post.value = null
    loading.value = true
    clearError()
    try {
      const { data } = await api.GET(detailPath(id))
      if (!current(token) || sequence !== readSequence) return
      if (!data.success) throw new Error('Board detail rejected')
      post.value = data.post
    } catch (error) {
      if (current(token) && sequence === readSequence) fail(error, true)
    } finally {
      if (current(token) && sequence === readSequence) loading.value = false
    }
  }
  function edit(create = false) {
    if (access.value !== 'member' || loading.value || saving.value || (!create && !post.value?.can_edit)) return
    ++readSequence
    clearError()
    draft.title = create ? '' : post.value?.title ?? ''
    draft.content = create ? '' : post.value?.content ?? ''
    view.value = create ? 'create' : 'edit'
  }
  async function save() {
    if (access.value !== 'member' || saving.value || !['create', 'edit'].includes(view.value)) return
    clearError()
    const body: components['schemas']['GroupPostWrite'] = { title: draft.title.trim(), content: draft.content.trim() }
    if (!body.title || [...body.title].length > 200) fields.title = '제목을 1~200자로 입력해 주세요.'
    if (!body.content || [...body.content].length > 10000) fields.content = '내용을 1~10,000자로 입력해 주세요.'
    if (fields.title || fields.content) return
    const token = ticket()
    const id = detailId
    if (view.value === 'edit' && id === null) return
    const creating = view.value === 'create'
    saving.value = true
    try {
      const data = creating ? await api.POST(listPath(), body)
        : await api.PATCH(detailPath(Number(id)), body)
      if (!current(token)) return
      if (!data.success) throw new Error('Board save rejected')
      post.value = data.post
      detailId = data.post.id
      view.value = 'detail'
      draft.title = ''
      draft.content = ''
      if (creating) page.value = 1
    } catch (error) {
      if (current(token)) fail(error, !creating)
    } finally {
      if (current(token)) saving.value = false
    }
  }
  async function remove() {
    if (access.value !== 'member' || saving.value || !post.value?.can_delete) return
    const token = ticket()
    const id = post.value.id
    saving.value = true
    clearError()
    try {
      const confirmed = await modal.confirm({
        title: '게시글을 삭제할까요?', description: '삭제한 게시글은 복구할 수 없어요.',
        confirmText: '삭제', cancelText: '취소', confirmVariant: 'danger', icon: 'warning',
      })
      if (!confirmed || !current(token)) return
      const data = await api.DELETE(detailPath(id))
      if (!current(token)) return
      if (!data.success) throw new Error('Board delete rejected')
      saving.value = false
      // Start at a valid page even when deleting the last post on the last page.
      await loadList(1)
    } catch (error) {
      if (current(token)) fail(error, true)
    } finally {
      if (current(token)) saving.value = false
    }
  }
  function cancel() {
    if (saving.value) return
    draft.title = ''
    draft.content = ''
    if (view.value === 'edit' && detailId !== null) void open(detailId)
    else void loadList()
  }
  function retry() {
    if (view.value === 'detail' && detailId !== null) void open(detailId)
    else void loadList()
  }
  function paginate(direction: -1 | 1) {
    if (loading.value || saving.value || (direction === -1 ? page.value <= 1 : !hasNext.value)) return
    void loadList(page.value + direction)
  }
  function reset() {
    generation++
    readSequence++
    posts.value = []
    post.value = null
    draft.title = ''
    draft.content = ''
    detailId = null
    page.value = 1
    count.value = 0
    hasNext.value = false
    loading.value = false
    saving.value = false
    view.value = 'list'
    clearError()
    if (ready.value && access.value === 'member') void loadList(1)
  }
  async function confirmNativeReturn() {
    if (saving.value) return false
    const editing = view.value === 'create' || view.value === 'edit'
    const dirty = view.value === 'create'
      ? !!(draft.title || draft.content)
      : draft.title !== post.value?.title || draft.content !== post.value?.content
    if (!editing || !dirty) return true
    const token = ticket()
    const confirmed = await modal.confirm({
      title: '작성 중인 글을 닫을까요?',
      description: '저장하지 않은 내용은 사라져요.',
      confirmText: '닫기', cancelText: '계속 작성', confirmVariant: 'danger', icon: 'warning',
    })
    return confirmed && current(token)
  }
  watch(owner, reset, { flush: 'sync' })
  onMounted(async () => {
    window.__maeilConfirmNativeReturn = confirmNativeReturn
    if (!auth.isInitialized.value) await auth.initialize()
    if (disposed) return
    ready.value = true
    if (access.value === 'member') void loadList()
  })
  onUnmounted(() => {
    disposed = true; ready.value = false; generation++; readSequence++
    if (window.__maeilConfirmNativeReturn === confirmNativeReturn) delete window.__maeilConfirmNativeReturn
  })
  return {
    posts, post, view, page, count, hasNext, loading, saving, failure, message, draft, fields, access,
    loadList, open, edit, save, remove, cancel, retry, paginate, revalidate: auth.revalidate,
  }
}
