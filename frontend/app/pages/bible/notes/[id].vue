<template>
  <div class="bible-page note-detail-page">
    <header class="bible-page-header">
      <button type="button" class="bible-back-btn" aria-label="뒤로가기" :disabled="isSaving || isDeleting || isConfirming" @click="handleBack">
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <h1>묵상노트</h1>
      <button v-if="note" type="button" class="bible-header-btn danger" aria-label="묵상노트 삭제" :disabled="isSaving || isDeleting || isConfirming" @click="handleDelete">
        <Trash2 :size="20" aria-hidden="true" />
      </button>
    </header>

    <div v-if="isLoading" class="note-loading" role="status" aria-label="묵상노트 불러오는 중" :aria-busy="true">
      <SkeletonCard padding="20px" rounded="xl">
        <template #body><SkeletonText :lines="12" last-line-width="60%" /></template>
      </SkeletonCard>
    </div>
    <EmptyState v-else-if="!note" title="묵상노트를 찾을 수 없습니다" description="노트가 없거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.">
      <template #icon><FileText :size="32" aria-hidden="true" /></template>
      <template #action>
        <div class="empty-actions">
          <AppButton class="retry-btn" variant="secondary" @click="loadNote">다시 시도</AppButton>
          <AppButton to="/bible/notes" variant="ghost">목록으로 돌아가기</AppButton>
        </div>
      </template>
    </EmptyState>

    <div v-else class="note-editor">
      <NuxtLink :to="bibleLocation" class="note-location">
        <BookOpen :size="16" aria-hidden="true" />
        <span>{{ note.book_name || getBookName(note.book) }} {{ note.chapter }}장<template v-if="note.start_verse"> {{ verseLabel }}절</template></span>
        <ChevronRight :size="16" aria-hidden="true" />
      </NuxtLink>
      <label for="note-content" class="sr-only">묵상 내용</label>
      <textarea id="note-content" v-model="editContent" placeholder="말씀을 읽고 떠오른 생각을 적어보세요." class="content-editor" :disabled="isDeleting || isConfirming" :aria-describedby="actionError ? 'note-error' : undefined" />
      <div class="note-options">
        <label class="private-toggle">
          <input v-model="isPrivate" type="checkbox" role="switch" :aria-checked="isPrivate" :disabled="isDeleting || isConfirming" />
          <span class="toggle-slider" aria-hidden="true"></span>
          <span>비공개</span>
        </label>
        <time class="last-updated" :datetime="note.updated_at">{{ formatDate(note.updated_at) }} 수정됨</time>
      </div>
      <div class="action-bar">
        <p v-if="actionError" id="note-error" class="note-error" role="alert">{{ actionError }}</p>
        <p class="save-status" role="status" aria-live="polite" :data-state="saveState">
          {{ isDeleting ? '노트를 삭제하고 있어요.' : isSaving ? '변경 내용을 저장하고 있어요.' : hasChanges ? '아직 저장하지 않은 변경 내용이 있어요.' : '변경 내용이 모두 저장되었어요.' }}
        </p>
        <AppButton class="save-btn" :variant="hasChanges ? 'primary' : 'secondary'" block :loading="isSaving" :disabled="!hasChanges || isDeleting || isConfirming" @click="handleSave">
          <Check v-if="!hasChanges && !isSaving" :size="18" aria-hidden="true" />
          {{ isSaving ? '저장 중…' : hasChanges ? '저장' : '저장됨' }}
        </AppButton>
      </div>
    </div>
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { BookOpen, Check, ChevronLeft, ChevronRight, FileText, Trash2 } from '@lucide/vue';
import { useNote, type Note } from '~/composables/useNote';
import { useBibleData } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useToast } from '~/composables/useToast';
import { TIMING } from '~/constants/bible';
import AppButton from '~/components/ui/AppButton.vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Toast from '~/components/Toast.vue';
import SkeletonCard from '~/components/ui/skeleton/SkeletonCard.vue';
import SkeletonText from '~/components/ui/skeleton/SkeletonText.vue';

definePageMeta({ layout: 'default' });
const route = useRoute();
const router = useRouter();
const { handleApiError } = useErrorHandler();
const modal = useModal();
const toast = useToast();
const { fetchNote, updateNote, deleteNote } = useNote();
const { getBookName } = useBibleData();
// CRUD's shared loading flag also covers PATCH/DELETE. Keep initial loading and
// the displayed note local so writes never replace the editor with a skeleton,
// and a late GET for a previous route cannot replace the current draft.
const note = ref<Note | null>(null);
const isLoading = ref(true);
const editContent = ref('');
const isPrivate = ref(true);
const originalContent = ref('');
const originalPrivate = ref(true);
const isSaving = ref(false);
const isDeleting = ref(false);
const isConfirming = ref(false);
const errorKind = ref<'save' | 'delete' | null>(null);
const noteId = computed(() => Number(route.params.id));
const hasChanges = computed(() => editContent.value !== originalContent.value || isPrivate.value !== originalPrivate.value);
const saveState = computed(() => isSaving.value ? 'saving' : errorKind.value === 'save' ? 'error' : hasChanges.value ? 'dirty' : 'saved');
const actionError = computed(() => errorKind.value === 'save' ? '노트를 저장하지 못했어요. 내용은 그대로 있으니 다시 저장해 주세요.' : errorKind.value === 'delete' ? '노트를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' : '');
const verseLabel = computed(() => note.value?.end_verse && note.value.end_verse !== note.value.start_verse ? `${note.value.start_verse}-${note.value.end_verse}` : String(note.value?.start_verse ?? ''));
const bibleLocation = computed(() => ({ path: '/bible', query: {
  book: note.value?.book,
  chapter: String(note.value?.chapter ?? 1),
  ...(note.value?.start_verse ? { verse: verseLabel.value } : {}),
} }));
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let loadVersion = 0;
let disposed = false;
let deleted = false;

function clearAutosave() {
  if (saveTimeout !== null) clearTimeout(saveTimeout);
  saveTimeout = null;
}
function scheduleAutosave() {
  clearAutosave();
  if (!disposed && note.value && hasChanges.value && !isLoading.value && !isSaving.value && !isDeleting.value && !isConfirming.value && !errorKind.value) {
    saveTimeout = setTimeout(handleSave, TIMING.AUTO_SAVE_DEBOUNCE);
  }
}
async function loadNote() {
  const version = ++loadVersion;
  clearAutosave();
  isLoading.value = true;
  note.value = null;
  errorKind.value = null;
  deleted = false;
  editContent.value = originalContent.value = '';
  isPrivate.value = originalPrivate.value = true;
  const loaded = Number.isSafeInteger(noteId.value) && noteId.value > 0 ? await fetchNote(noteId.value) : null;
  if (disposed || version !== loadVersion) return;
  note.value = loaded;
  if (loaded) {
    editContent.value = originalContent.value = loaded.content;
    isPrivate.value = originalPrivate.value = loaded.is_private;
  }
  isLoading.value = false;
}
async function handleSave() {
  if (!note.value || !hasChanges.value || isSaving.value || isDeleting.value || isConfirming.value) return;
  clearAutosave();
  // A user can keep typing while PATCH is pending; only this snapshot is saved.
  const snapshot = { content: editContent.value, is_private: isPrivate.value };
  isSaving.value = true;
  errorKind.value = null;
  try {
    const saved = await updateNote(note.value.id, snapshot);
    if (!saved) throw new Error('노트 저장 결과가 없습니다');
    note.value = saved;
    originalContent.value = snapshot.content;
    originalPrivate.value = snapshot.is_private;
    toast.success('노트를 저장했어요');
  } catch (error) {
    errorKind.value = 'save';
    handleApiError(error, '묵상노트 저장');
  } finally {
    isSaving.value = false;
    scheduleAutosave();
  }
}
async function handleDelete() {
  if (!note.value || isSaving.value || isDeleting.value || isConfirming.value) return;
  clearAutosave();
  isConfirming.value = true;
  const confirmed = await modal.confirm({ title: '노트를 삭제할까요?', description: '삭제한 묵상노트는 되돌릴 수 없어요.', confirmText: '삭제', cancelText: '취소', confirmVariant: 'danger', icon: 'warning' });
  isConfirming.value = false;
  if (!confirmed) { scheduleAutosave(); return; }
  isDeleting.value = true;
  errorKind.value = null;
  try {
    // useNote returns false (not a rejection) for a failed DELETE.
    if (!await deleteNote(note.value.id)) throw new Error('노트를 삭제하지 못했습니다');
    deleted = true;
    clearAutosave();
    await router.push('/bible/notes');
  } catch (error) {
    errorKind.value = 'delete';
    handleApiError(error, '묵상노트 삭제');
  } finally {
    isDeleting.value = false;
  }
}
async function confirmExit() {
  if (deleted) return true;
  if (isSaving.value || isDeleting.value || isConfirming.value) return false;
  if (!hasChanges.value) return true;
  clearAutosave();
  isConfirming.value = true;
  const confirmed = await modal.confirm({ title: '저장하지 않고 나갈까요?', description: '저장하지 않은 변경 내용은 사라져요.', confirmText: '나가기', cancelText: '계속 작성', confirmVariant: 'danger', icon: 'warning' });
  isConfirming.value = false;
  if (!confirmed) scheduleAutosave();
  return confirmed;
}
onBeforeRouteLeave(confirmExit);
onBeforeRouteUpdate((to, from) => to.params.id !== from.params.id ? confirmExit() : true);
function handleBack() { router.back(); }
function beforeUnload(event: BeforeUnloadEvent) {
  if (!deleted && (hasChanges.value || isSaving.value || isDeleting.value)) {
    event.preventDefault();
    event.returnValue = '';
  }
}
const formatDate = (value: string) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
watch([editContent, isPrivate], scheduleAutosave);
watch(noteId, loadNote);
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  void loadNote();
});
onBeforeUnmount(() => {
  disposed = true;
  clearAutosave();
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<style scoped>
.note-detail-page { display: flex; flex-direction: column; width: 100%; min-width: 0; color: var(--color-text-primary); font-family: var(--font-sans); letter-spacing: var(--tracking-body); }
.note-detail-page .bible-page-header { min-height: var(--appbar-height); box-sizing: border-box; padding: 0 var(--screen-gutter); gap: 8px; background: var(--color-bg-primary); border-color: var(--color-border-default); }
.note-detail-page .bible-page-header h1 { font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
.bible-back-btn, .bible-header-btn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; min-width: var(--hit-min); min-height: var(--hit-min); margin: 0; padding: 0; border: 0; border-radius: var(--radius-pill); color: var(--color-text-primary); background: transparent; cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.bible-header-btn.danger { color: var(--color-error); }
.bible-back-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.bible-header-btn:hover:not(:disabled) { background: var(--color-error-bg); }
.bible-back-btn:disabled, .bible-header-btn:disabled { opacity: .5; cursor: not-allowed; }
.note-loading { padding: var(--screen-gutter); }
.empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.note-editor { flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0; padding: 20px var(--screen-gutter) 0; }
.note-location { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; box-sizing: border-box; min-height: var(--hit-min); max-width: 100%; padding: 8px 16px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); color: var(--color-accent-primary); background: var(--color-accent-bg); font-size: 14px; font-weight: 600; text-decoration: none; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.note-location svg { flex-shrink: 0; }
.note-location span { overflow-wrap: anywhere; }
.note-location:hover { background: var(--color-bg-hover); }
.content-editor { flex: 1; box-sizing: border-box; width: 100%; min-height: 300px; padding: var(--card-padding); border: 1px solid var(--color-border-default); border-radius: var(--radius-card); font: inherit; font-size: 16px; line-height: 1.75; color: var(--color-text-primary); background: var(--color-bg-card); box-shadow: var(--shadow-card); resize: vertical; }
.content-editor::placeholder { color: var(--color-text-tertiary); }
.content-editor:disabled { cursor: not-allowed; }
.note-options { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.private-toggle { position: relative; display: inline-flex; align-items: center; min-height: var(--hit-min); gap: 8px; font-size: 14px; color: var(--color-text-secondary); cursor: pointer; }
.private-toggle input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.toggle-slider { position: relative; width: 44px; height: 28px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-tertiary); transition: background-color var(--duration-micro) ease; }
.toggle-slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: var(--radius-pill); background: var(--color-text-secondary); transition: transform var(--duration-micro) ease, background-color var(--duration-micro) ease; }
.private-toggle input:checked + .toggle-slider { background: var(--color-accent-primary); border-color: var(--color-accent-primary); }
.private-toggle input:checked + .toggle-slider::after { transform: translateX(16px); background: var(--color-text-inverse); }
.private-toggle input:disabled { cursor: not-allowed; }
.private-toggle input:disabled ~ span { opacity: .5; }
.last-updated { font-size: 12px; color: var(--color-text-tertiary); overflow-wrap: anywhere; }
.action-bar { position: sticky; bottom: 0; z-index: 2; margin-top: auto; padding: 12px 0 max(20px, env(safe-area-inset-bottom)); background: var(--color-bg-primary); }
.save-status { margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
.note-error { margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: var(--color-error); }
.save-btn { min-height: 48px; }
.bible-back-btn:focus-visible, .bible-header-btn:focus-visible, .note-location:focus-visible, .content-editor:focus-visible, .private-toggle input:focus-visible + .toggle-slider { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.bible-back-btn:active:not(:disabled), .bible-header-btn:active:not(:disabled), .note-location:active { transform: scale(.97); }
.private-toggle:hover .toggle-slider { border-color: var(--color-accent-primary); }
.private-toggle:active .toggle-slider { filter: brightness(.95); }
@media (min-width: 1024px) { .note-detail-page { max-width: var(--content-max); } .note-editor { padding-inline: 40px; } }
@media (prefers-reduced-motion: reduce) { .bible-back-btn, .bible-header-btn, .note-location, .toggle-slider, .toggle-slider::after { transition: none; } .bible-back-btn:active, .bible-header-btn:active, .note-location:active { transform: none; } }
</style>
