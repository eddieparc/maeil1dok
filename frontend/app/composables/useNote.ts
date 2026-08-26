/**
 * Note Composable
 *
 * 묵상노트 CRUD 기능 제공
 */
import { ref, type Ref } from 'vue';
import { useAuthService } from '~/composables/useAuthService';
import { useApi } from './useApi';
import type { Note } from '~/types/bible';
import type { components } from '~/types/generated/api-schema';

const normalizeNote = (note: components['schemas']['ReflectionNote']): Note => ({
  ...note,
  start_verse: note.start_verse ?? undefined,
  end_verse: note.end_verse ?? undefined,
  is_private: note.is_private ?? true,
});

// Re-export for backward compatibility
export type { Note } from '~/types/bible';

export const useNote = () => {
  const auth = useAuthService();
  const api = useApi();

  // 상태
  const notes: Ref<Note[]> = ref([]);
  const currentChapterNotes: Ref<Note[]> = ref([]);
  const currentNote: Ref<Note | null> = ref(null);
  const isNoteLoading = ref(false);
  const showNoteModal = ref(false);
  const editingNote: Ref<Note | null> = ref(null);
  const noteContent = ref('');

  /**
   * 전체 묵상노트 목록 불러오기
   */
  const fetchNotes = async (): Promise<Note[]> => {
    if (!auth.isAuthenticated.value) return [];

    try {
      isNoteLoading.value = true;
      const response = await api.GET('/api/v1/todos/bible/notes/');
      notes.value = response.data.results.map(normalizeNote);
      return notes.value;
    } catch (error) {
      console.error('노트 목록 조회 실패:', error);
      notes.value = [];
      return [];
    } finally {
      isNoteLoading.value = false;
    }
  };

  /**
   * 현재 장의 묵상노트 불러오기
   */
  const fetchChapterNotes = async (book: string, chapter: number): Promise<Note[]> => {
    if (!auth.isAuthenticated.value) return [];

    try {
      const response = await api.GET('/api/v1/todos/bible/notes/by-chapter/', {
        params: { book, chapter }
      });
      currentChapterNotes.value = response.data.notes.map(normalizeNote);
      return currentChapterNotes.value;
    } catch (error) {
      console.error('장별 노트 조회 실패:', error);
      currentChapterNotes.value = [];
      return [];
    }
  };

  /**
   * 노트 상세 조회
   */
  const fetchNote = async (id: number): Promise<Note | null> => {
    if (!auth.isAuthenticated.value) return null;

    try {
      isNoteLoading.value = true;
      const response = await api.GET(api.path('/api/v1/todos/bible/notes/{id}/', { id }));
      currentNote.value = normalizeNote(response.data);
      return currentNote.value;
    } catch (error) {
      console.error('노트 조회 실패:', error);
      currentNote.value = null;
      return null;
    } finally {
      isNoteLoading.value = false;
    }
  };

  /**
   * 노트 생성
   */
  const createNote = async (data: {
    book: string;
    chapter: number;
    start_verse?: number;
    end_verse?: number;
    content: string;
    is_private?: boolean;
  }): Promise<Note | null> => {
    if (!auth.isAuthenticated.value) {
      throw new Error('로그인이 필요합니다');
    }

    try {
      isNoteLoading.value = true;
      const response = await api.POST('/api/v1/todos/bible/notes/', {
        is_private: true,
        ...data
      });
      const newNote = normalizeNote(response);
      currentChapterNotes.value.push(newNote);
      return newNote;
    } catch (error) {
      console.error('노트 생성 실패:', error);
      throw error;
    } finally {
      isNoteLoading.value = false;
    }
  };

  /**
   * 노트 수정
   */
  const updateNote = async (id: number, data: Partial<Note>): Promise<Note | null> => {
    if (!auth.isAuthenticated.value) {
      throw new Error('로그인이 필요합니다');
    }

    try {
      isNoteLoading.value = true;
      const response = await api.PATCH(
        api.path('/api/v1/todos/bible/notes/{id}/', { id }),
        data,
      );
      const updatedNote = normalizeNote(response);

      // 목록 업데이트
      const index = notes.value.findIndex(n => n.id === id);
      if (index !== -1) {
        notes.value[index] = updatedNote;
      }

      // 현재 장 노트 업데이트
      const chapterIndex = currentChapterNotes.value.findIndex(n => n.id === id);
      if (chapterIndex !== -1) {
        currentChapterNotes.value[chapterIndex] = updatedNote;
      }

      currentNote.value = updatedNote;
      return updatedNote;
    } catch (error) {
      console.error('노트 수정 실패:', error);
      throw error;
    } finally {
      isNoteLoading.value = false;
    }
  };

  /**
   * 노트 삭제
   */
  const deleteNote = async (id: number, book?: string, chapter?: number): Promise<boolean> => {
    if (!auth.isAuthenticated.value) {
      throw new Error('로그인이 필요합니다');
    }

    try {
      isNoteLoading.value = true;
      await api.DELETE(api.path('/api/v1/todos/bible/notes/{id}/', { id }));

      notes.value = notes.value.filter(n => n.id !== id);
      currentChapterNotes.value = currentChapterNotes.value.filter(n => n.id !== id);

      if (currentNote.value?.id === id) {
        currentNote.value = null;
      }

      // 장별 노트 새로고침
      if (book && chapter) {
        await fetchChapterNotes(book, chapter);
      }

      return true;
    } catch (error) {
      console.error('노트 삭제 실패:', error);
      return false;
    } finally {
      isNoteLoading.value = false;
    }
  };

  /**
   * 특정 장에 노트가 있는지 확인
   */
  const hasNoteForChapter = (book: string, chapter: number): boolean => {
    return currentChapterNotes.value.some(
      n => n.book === book && n.chapter === chapter
    );
  };

  /**
   * 현재 장의 노트 개수
   */
  const getChapterNoteCount = (): number => {
    return currentChapterNotes.value.length;
  };

  /**
   * 묵상노트 모달 열기 (빠른 메모용)
   */
  const openNoteModal = (book: string, chapter: number): void => {
    const existingNote = currentChapterNotes.value.find(
      n => n.book === book && n.chapter === chapter
    );

    if (existingNote) {
      editingNote.value = existingNote;
      noteContent.value = existingNote.content;
    } else {
      editingNote.value = null;
      noteContent.value = '';
    }

    showNoteModal.value = true;
  };

  /**
   * 묵상노트 모달 닫기
   */
  const closeNoteModal = (): void => {
    showNoteModal.value = false;
    editingNote.value = null;
    noteContent.value = '';
  };

  /**
   * 빠른 메모 저장
   */
  const saveQuickNote = async (book: string, chapter: number, content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    if (!auth.isAuthenticated.value) return false;

    try {
      isNoteLoading.value = true;

      if (editingNote.value) {
        // 수정
        await updateNote(editingNote.value.id, { content });
      } else {
        // 새로 작성
        await createNote({
          book,
          chapter,
          content,
          is_private: true
        });
      }

      closeNoteModal();
      await fetchChapterNotes(book, chapter);
      return true;
    } catch (error) {
      console.error('묵상노트 저장 실패:', error);
      return false;
    } finally {
      isNoteLoading.value = false;
    }
  };

  return {
    // 상태
    notes,
    currentChapterNotes,
    currentNote,
    isNoteLoading,
    showNoteModal,
    editingNote,
    noteContent,

    // 함수
    fetchNotes,
    fetchChapterNotes,
    fetchNote,
    createNote,
    updateNote,
    deleteNote,
    hasNoteForChapter,
    getChapterNoteCount,
    openNoteModal,
    closeNoteModal,
    saveQuickNote,
  };
};
