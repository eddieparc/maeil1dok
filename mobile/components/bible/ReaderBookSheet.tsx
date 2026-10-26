import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BIBLE_BOOKS, chapterUnit, type ChapterRef } from '../../api/bibleBooks';
import type { BibleVersion } from '../../api/bibleContent';
import { useNativeColors } from '../ui/tokens';

interface Props {
  readonly visible: boolean;
  readonly location: ChapterRef;
  readonly version: string;
  readonly versions: readonly BibleVersion[];
  readonly readChapters: ReadonlySet<number>;
  readonly onSelect: (location: ChapterRef) => void;
  readonly onVersion: (version: string) => void;
  readonly onCompare: () => void;
  readonly onClose: () => void;
}

export default function ReaderBookSheet(props: Props) {
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(props.location.book);
  const [query, setQuery] = useState('');
  const chaptersRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (props.visible) { setSelected(props.location.book); setQuery(''); }
  }, [props.visible, props.location.book]);
  const book = BIBLE_BOOKS.find(item => item.id === selected) ?? BIBLE_BOOKS[0];
  const normalized = query.trim().replace(/\s/g, '');
  const term = normalized.replace(/[0-9장편:절]/g, '');
  const requestedChapter = Number(normalized.match(/\d+/)?.[0]);
  const matches = BIBLE_BOOKS.filter(item => !term || item.name.includes(term) || item.id === term);
  const submit = () => {
    const target = term ? matches[0] : book;
    if (!target) return;
    if (requestedChapter >= 1 && requestedChapter <= target.chapters) {
      props.onSelect({ book: target.id, chapter: requestedChapter });
    } else {
      setSelected(target.id);
      chaptersRef.current?.scrollTo({ y: 0, animated: false });
    }
  };
  const text = { color: colors.text, fontFamily: 'Pretendard-Regular' };
  const chip = { borderColor: colors.border, backgroundColor: colors.surface };
  const active = { borderColor: colors.accent, backgroundColor: colors.accentSurface };
  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
    <View style={styles.overlay}>
      <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.scrim }]}
        accessibilityLabel="성경 선택 닫기" onPress={props.onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[text, styles.title]}>성경 선택</Text>
          <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="닫기" style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.versions}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {props.versions.map(version => <Pressable key={version.code}
              accessibilityRole="button" accessibilityState={{ selected: props.version === version.code }}
              onPress={() => props.onVersion(version.code)}
              style={[styles.chip, chip, props.version === version.code && active]}>
              <Text style={[text, styles.chipText, props.version === version.code && { color: colors.accent }]}>
                {version.name}
              </Text>
            </Pressable>)}
          </ScrollView>
          <Pressable style={[styles.chip, chip]} onPress={props.onCompare}
            accessibilityRole="button" accessibilityLabel="역본 비교">
            <Ionicons name="albums-outline" size={14} color={colors.textSecondary} />
            <Text style={[text, styles.chipText]}>역본 비교</Text>
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={submit}
            accessibilityLabel="성경 책과 장 검색" placeholder="성경 검색 (예: 창세기 1장)"
            placeholderTextColor={colors.textMuted} returnKeyType="go"
            style={[text, styles.input]} />
          {query !== '' && <Pressable accessibilityLabel="검색 입력 지우기" style={styles.close} onPress={() => setQuery('')}>
            <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
          </Pressable>}
        </View>
        {requestedChapter > 0 && <Pressable style={[styles.result, { backgroundColor: colors.accent }]}
          onPress={submit} accessibilityRole="button">
          <Text style={{ color: colors.onAccent }}>{matches[0]?.name ?? book.name} {requestedChapter}{chapterUnit(matches[0]?.id ?? book.id)}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
        </Pressable>}
        <View style={styles.columns}>
          <ScrollView keyboardShouldPersistTaps="handled" style={[styles.books, { borderColor: colors.border }]}>
            {(['old', 'new'] as const).map(testament => <View key={testament}>
              <Text style={[styles.testament, { color: colors.textMuted, backgroundColor: colors.background }]}>
                {testament === 'old' ? '구약' : '신약'}
              </Text>
              {matches.filter(item => item.testament === testament).map(item => <Pressable key={item.id}
                accessibilityRole="button" accessibilityState={{ selected: item.id === selected }}
                onPress={() => { setSelected(item.id); chaptersRef.current?.scrollTo({ y: 0, animated: false }); }}
                style={[styles.book, item.id === selected && { backgroundColor: colors.accentSurface }]}>
                <Text style={[text, { color: item.id === selected ? colors.accent : colors.text }]}>{item.name}</Text>
              </Pressable>)}
            </View>)}
          </ScrollView>
          <ScrollView ref={chaptersRef} keyboardShouldPersistTaps="handled" style={styles.chapters}>
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map(chapter => {
              const current = selected === props.location.book && chapter === props.location.chapter;
              const read = selected === props.location.book && props.readChapters.has(chapter);
              return <Pressable key={chapter} accessibilityRole="button" accessibilityState={{ selected: current }}
                onPress={() => props.onSelect({ book: selected, chapter })}
                style={[styles.chapter, current && { backgroundColor: colors.accentSurface }]}>
                <Text style={[text, { color: current ? colors.accent : colors.textSecondary }]}>{chapter}{chapterUnit(selected)}</Text>
                {read && <Ionicons name="checkmark" size={12} color={colors.accent} />}
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 768, alignSelf: 'center',
    height: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8 },
  title: { fontFamily: 'Pretendard-SemiBold', fontSize: 17 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  versions: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  chipText: { fontSize: 13 },
  search: { marginHorizontal: 16, marginVertical: 8, paddingLeft: 12, borderRadius: 10,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 44, fontSize: 14 },
  result: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10,
    flexDirection: 'row', justifyContent: 'space-between' },
  columns: { flex: 1, flexDirection: 'row' },
  books: { flexGrow: 7, flexShrink: 1, flexBasis: 0, borderRightWidth: 1 },
  chapters: { flexGrow: 3, flexShrink: 1, flexBasis: 0 },
  testament: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, paddingVertical: 10, paddingHorizontal: 16 },
  book: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  chapter: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
});
