import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthSession';
import {
  BIBLE_BOOKS,
  chapterCount,
  chapterLabel,
  isBibleBook,
  nextChapter,
  prevChapter,
  type BibleBook,
  type ChapterRef,
} from '../api/bibleBooks';
import {
  normalizeVersionList,
  parseBibleContent,
  type BibleBlock,
  type BibleVersion,
} from '../api/bibleContent';

/** 앱에 노출하는 한국어 역본 (서버 목록 중 이 코드만 표시). */
const VISIBLE_VERSION_CODES = ['GAE', 'KNT', 'SAENEW', 'HAN', 'SAE', 'COG', 'COGNEW'] as const;
const VISIBLE_VERSION_SET = new Set<string>(VISIBLE_VERSION_CODES);

/** versions API 실패 시 사용하는 정적 폴백. */
const FALLBACK_VERSIONS: readonly BibleVersion[] = [
  { code: 'GAE', name: '개역개정' },
  { code: 'KNT', name: '새한글' },
  { code: 'SAENEW', name: '새번역' },
  { code: 'HAN', name: '개역한글' },
  { code: 'SAE', name: '표준새번역' },
  { code: 'COG', name: '공동번역' },
  { code: 'COGNEW', name: '공동번역 개정판' },
];

const DEFAULT_LOCATION: ChapterRef = { book: 'gen', chapter: 1 };
const DEFAULT_VERSION = 'GAE';

type LoadState = 'loading' | 'ready' | 'error';

interface SavedPosition {
  readonly book: string;
  readonly chapter: number;
  readonly version: string;
  readonly scrollPosition: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 서버 읽기 위치 검증: 웹과 같은 규칙 (book 유효, chapter 범위, scroll 0..1). */
const parseSavedPosition = (value: unknown): SavedPosition | null => {
  if (!isRecord(value)) return null;
  const { book, chapter, version, scroll_position } = value;
  if (typeof book !== 'string' || !isBibleBook(book)) return null;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter)) return null;
  if (chapter < 1 || chapter > chapterCount(book)) return null;
  if (typeof version !== 'string' || !VISIBLE_VERSION_SET.has(version)) return null;
  if (
    typeof scroll_position !== 'number' ||
    !Number.isFinite(scroll_position) ||
    scroll_position < 0 ||
    scroll_position > 1
  ) {
    return null;
  }
  return { book, chapter, version, scrollPosition: scroll_position };
};

export default function BibleScreen() {
  const { status, apiFetch } = useAuth();

  const [location, setLocation] = useState<ChapterRef>(DEFAULT_LOCATION);
  const [version, setVersion] = useState<string>(DEFAULT_VERSION);
  const [blocks, setBlocks] = useState<readonly BibleBlock[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [picker, setPicker] = useState<'none' | 'book' | 'chapter' | 'version'>('none');
  const [pickerBook, setPickerBook] = useState<BibleBook | null>(null);
  const [versions, setVersions] = useState<readonly BibleVersion[]>(FALLBACK_VERSIONS);
  const [readChapters, setReadChapters] = useState<ReadonlySet<number>>(new Set());

  const signedIn = status === 'signedIn';
  const listRef = useRef<FlatList<BibleBlock>>(null);
  const pendingScrollFraction = useRef<number | null>(null);
  const scrollFraction = useRef(0);
  const contentHeight = useRef(0);
  const viewHeight = useRef(0);
  const requestSeq = useRef(0);

  // 최신 값을 unmount 저장에서 읽기 위한 refs
  const locationRef = useRef(location);
  const versionRef = useRef(version);
  const signedInRef = useRef(signedIn);
  locationRef.current = location;
  versionRef.current = version;
  signedInRef.current = signedIn;

  const savePosition = useCallback(
    (loc: ChapterRef, ver: string, fraction: number) => {
      apiFetch('/api/v1/todos/bible/reading-position/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book: loc.book,
          chapter: loc.chapter,
          scroll_position: fraction,
          version: ver,
        }),
      }).catch((error) => console.warn('[Bible] reading-position save failed:', error));
    },
    [apiFetch],
  );

  // --- 초기 위치 복원: 로그인이면 서버 reading-position, 아니면 창세기 1장 ---
  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    if (!signedIn) {
      setLocation(DEFAULT_LOCATION);
      setVersion(DEFAULT_VERSION);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch('/api/v1/todos/bible/reading-position/');
        const json: unknown = await res.json();
        const position =
          res.ok && isRecord(json) && json.success === true
            ? parseSavedPosition(json.position)
            : null;
        if (cancelled) return;
        if (position) {
          pendingScrollFraction.current = position.scrollPosition;
          setLocation({ book: position.book, chapter: position.chapter });
          setVersion(position.version);
        } else {
          setLocation(DEFAULT_LOCATION);
          setVersion(DEFAULT_VERSION);
        }
      } catch (error) {
        console.warn('[Bible] reading-position restore failed:', error);
        if (!cancelled) {
          setLocation(DEFAULT_LOCATION);
          setVersion(DEFAULT_VERSION);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, signedIn, apiFetch]);

  // --- 본문 로드 ---
  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoadState('loading');
    (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/bible-cache/${version}/${location.book}/${location.chapter}/`,
        );
        const json: unknown = await res.json();
        if (seq !== requestSeq.current) return;
        const data = isRecord(json) && isRecord(json.data) ? json.data : null;
        const parsed =
          res.ok && data ? parseBibleContent(data.content, data.content_type) : [];
        if (parsed.length === 0) {
          setBlocks([]);
          setLoadState('error');
          return;
        }
        setBlocks(parsed);
        setLoadState('ready');
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.warn('[Bible] content load failed:', error);
        setBlocks([]);
        setLoadState('error');
      }
    })();
  }, [location, version, reloadToken, apiFetch]);

  // --- 장 변경 시: 위치 저장 + 읽음 기록 (로그인만, fire-and-forget) ---
  useEffect(() => {
    if (!signedIn || loadState !== 'ready') return;
    savePosition(location, version, scrollFraction.current);
    apiFetch('/api/v1/todos/bible/personal-records/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book: location.book, chapter: location.chapter }),
    }).catch((error) => console.warn('[Bible] personal-record save failed:', error));
  }, [signedIn, loadState, location, version, apiFetch, savePosition]);

  // --- 책별 읽은 장 (장 선택 그리드 표시용, 로그인만) ---
  useEffect(() => {
    if (!signedIn) {
      setReadChapters(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/todos/bible/personal-records/by-book/?book=${location.book}`,
        );
        const json: unknown = await res.json();
        if (cancelled || !res.ok || !isRecord(json) || json.success !== true) return;
        const list = Array.isArray(json.read_chapters) ? json.read_chapters : [];
        setReadChapters(
          new Set(list.filter((n): n is number => typeof n === 'number')),
        );
      } catch (error) {
        console.warn('[Bible] read-chapters load failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, location.book, apiFetch]);

  // --- 역본 목록 (보이는 한국어 역본만) ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/v1/bible-cache/versions/');
        const json: unknown = await res.json();
        if (cancelled || !res.ok) return;
        const visible = normalizeVersionList(json).filter((v) =>
          VISIBLE_VERSION_SET.has(v.code),
        );
        if (visible.length > 0) setVersions(visible);
      } catch (error) {
        console.warn('[Bible] version list load failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  // --- 화면을 떠날 때 마지막 스크롤 위치 저장 ---
  useEffect(
    () => () => {
      if (signedInRef.current) {
        savePosition(locationRef.current, versionRef.current, scrollFraction.current);
      }
    },
    [savePosition],
  );

  const prev = useMemo(() => prevChapter(location), [location]);
  const next = useMemo(() => nextChapter(location), [location]);

  const goTo = useCallback((ref: ChapterRef) => {
    pendingScrollFraction.current = null;
    scrollFraction.current = 0;
    setLocation(ref);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      contentHeight.current = contentSize.height;
      viewHeight.current = layoutMeasurement.height;
      const max = contentSize.height - layoutMeasurement.height;
      scrollFraction.current =
        max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0;
    },
    [],
  );

  const restoreScroll = useCallback(() => {
    const fraction = pendingScrollFraction.current;
    if (fraction === null) return;
    pendingScrollFraction.current = null;
    const max = contentHeight.current - viewHeight.current;
    if (fraction > 0 && max > 0) {
      listRef.current?.scrollToOffset({ offset: fraction * max, animated: false });
    }
  }, []);

  const versionName = useMemo(
    () => versions.find((v) => v.code === version)?.name ?? version,
    [versions, version],
  );

  const openChapterPicker = useCallback((book: BibleBook) => {
    setPickerBook(book);
    setPicker('chapter');
  }, []);

  const renderBlock = useCallback(({ item }: { item: BibleBlock }) => {
    if (item.type === 'heading') {
      return <Text style={styles.heading}>{item.text}</Text>;
    }
    if (item.type === 'note') {
      return <Text style={styles.note}>{item.text}</Text>;
    }
    return (
      <View style={styles.verseRow}>
        <Text style={styles.verseNum}>{item.num}</Text>
        <Text style={styles.verseText}>{item.text}</Text>
      </View>
    );
  }, []);

  const keyExtractor = useCallback(
    (item: BibleBlock, index: number) =>
      item.type === 'verse' ? `v${item.num}` : `${item.type}-${index}`,
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더: 이전/책·장/다음 + 역본 칩 */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="이전 장"
          disabled={!prev}
          onPress={() => prev && goTo(prev)}
          style={[styles.navButton, !prev && styles.navButtonDisabled]}
        >
          <Text style={[styles.navButtonText, !prev && styles.navButtonTextDisabled]}>‹</Text>
        </Pressable>
        <Pressable style={styles.titleButton} onPress={() => setPicker('book')}>
          <Text style={styles.title}>{chapterLabel(location.book, location.chapter)}</Text>
          <Text style={styles.titleChevron}>▾</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="다음 장"
          disabled={!next}
          onPress={() => next && goTo(next)}
          style={[styles.navButton, !next && styles.navButtonDisabled]}
        >
          <Text style={[styles.navButtonText, !next && styles.navButtonTextDisabled]}>›</Text>
        </Pressable>
        <Pressable style={styles.versionChip} onPress={() => setPicker('version')}>
          <Text style={styles.versionChipText}>{versionName}</Text>
        </Pressable>
      </View>

      {/* 본문 */}
      {loadState === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#376BCB" />
        </View>
      )}
      {loadState === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>본문을 불러오지 못했습니다</Text>
          <Pressable style={styles.retryButton} onPress={() => setReloadToken((n) => n + 1)}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      )}
      {loadState === 'ready' && (
        <FlatList
          ref={listRef}
          data={blocks as BibleBlock[]}
          renderItem={renderBlock}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={(w, h) => {
            contentHeight.current = h;
            restoreScroll();
          }}
          onLayout={(e) => {
            viewHeight.current = e.nativeEvent.layout.height;
          }}
        />
      )}

      {/* 책 선택 모달 (구약/신약 66권 그리드) */}
      <Modal
        visible={picker === 'book'}
        animationType="slide"
        onRequestClose={() => setPicker('none')}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>책 선택</Text>
            <Pressable onPress={() => setPicker('none')} hitSlop={12}>
              <Text style={styles.modalClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {(['old', 'new'] as const).map((testament) => (
              <View key={testament}>
                <Text style={styles.sectionLabel}>
                  {testament === 'old' ? '구약' : '신약'}
                </Text>
                <View style={styles.grid}>
                  {BIBLE_BOOKS.filter((b) => b.testament === testament).map((b) => (
                    <Pressable
                      key={b.id}
                      style={[
                        styles.gridCell,
                        b.id === location.book && styles.gridCellActive,
                      ]}
                      onPress={() => openChapterPicker(b)}
                    >
                      <Text
                        style={[
                          styles.gridCellText,
                          b.id === location.book && styles.gridCellTextActive,
                        ]}
                      >
                        {b.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 장 선택 모달 */}
      <Modal
        visible={picker === 'chapter'}
        animationType="slide"
        onRequestClose={() => setPicker('book')}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setPicker('book')} hitSlop={12}>
              <Text style={styles.modalBack}>‹ 책</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{pickerBook?.name ?? ''}</Text>
            <Pressable onPress={() => setPicker('none')} hitSlop={12}>
              <Text style={styles.modalClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.grid}>
              {pickerBook &&
                Array.from({ length: pickerBook.chapters }, (_, i) => i + 1).map(
                  (ch) => {
                    const isCurrent =
                      pickerBook.id === location.book && ch === location.chapter;
                    const isRead = readChapters.has(ch);
                    return (
                      <Pressable
                        key={ch}
                        style={[styles.gridCell, isCurrent && styles.gridCellActive]}
                        onPress={() => {
                          setPicker('none');
                          goTo({ book: pickerBook.id, chapter: ch });
                        }}
                      >
                        <Text
                          style={[
                            styles.gridCellText,
                            isCurrent && styles.gridCellTextActive,
                          ]}
                        >
                          {ch}
                        </Text>
                        {isRead && <View style={styles.readDot} />}
                      </Pressable>
                    );
                  },
                )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 역본 선택 모달 */}
      <Modal
        visible={picker === 'version'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker('none')}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker('none')}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>역본 선택</Text>
            {versions.map((v) => (
              <Pressable
                key={v.code}
                style={styles.sheetRow}
                onPress={() => {
                  setPicker('none');
                  if (v.code !== version) {
                    pendingScrollFraction.current = null;
                    scrollFraction.current = 0;
                    setVersion(v.code);
                  }
                }}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    v.code === version && styles.sheetRowTextActive,
                  ]}
                >
                  {v.name}
                </Text>
                {v.code === version && <Text style={styles.sheetCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e0db',
    gap: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 24,
    color: '#333',
    marginTop: -2,
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  titleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: '#333',
  },
  titleChevron: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#999',
  },
  versionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#eef2fb',
  },
  versionChipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#376BCB',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#376BCB',
  },
  retryButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#fff',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  heading: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  note: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
    lineHeight: 19,
  },
  verseRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  verseNum: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: '#376BCB',
    width: 24,
    marginTop: 5,
  },
  verseText: {
    flex: 1,
    fontFamily: 'Pretendard-Regular',
    fontSize: 17,
    lineHeight: 29,
    color: '#2b2b2b',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e0db',
  },
  modalTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: '#333',
  },
  modalClose: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#376BCB',
  },
  modalBack: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#376BCB',
    width: 48,
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gridCell: {
    width: '23%',
    minWidth: 72,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e0db',
  },
  gridCellActive: {
    backgroundColor: '#376BCB',
    borderColor: '#376BCB',
  },
  gridCellText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#333',
  },
  gridCellTextActive: {
    color: '#fff',
  },
  readDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#376BCB',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  sheetRowText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: '#333',
  },
  sheetRowTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#376BCB',
  },
  sheetCheck: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#376BCB',
  },
});
