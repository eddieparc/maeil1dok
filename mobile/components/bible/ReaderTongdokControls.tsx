import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { TongdokState } from '../../api/readerTongdok';
import { useNativeColors } from '../ui/tokens';

interface Props {
  readonly state: TongdokState;
  readonly onToggle: () => void;
  readonly onRetry: () => void;
  readonly onNext: () => void;
  readonly onSchedule: () => void;
  readonly onExit: () => void;
  readonly onLogin: () => void;
}

export default function ReaderTongdokControls({
  state, onToggle, onRetry, onNext, onSchedule, onExit, onLogin,
}: Props) {
  const colors = useNativeColors();
  const styles = createStyles(colors);
  if (!state.context.enabled) return null;
  const checked = state.detail?.rows.every(row => row.complete) ?? false;
  const disabled = state.busy || state.loading || !state.detail;
  const chapters = state.detail?.rows.flatMap(row => Array.from({ length: row.end - row.start + 1 },
    (_, index) => ({ book: row.book, chapter: row.start + index, complete: row.complete }))) ?? [];
  const done = chapters.filter(chapter => chapter.complete).length;
  return (
    <View style={styles.container} testID="reader-tongdok-context">
      <View style={styles.actions}>
        <View style={styles.progress} accessibilityRole="progressbar"
          accessibilityLabel="통독 진도" accessibilityValue={{ min: 0, max: chapters.length, now: done }}>
          {chapters.map((chapter, index) => <View key={index} style={[styles.segment,
            { backgroundColor: chapter.complete ? colors.accent
              : chapter.book === state.location.book && chapter.chapter === state.location.chapter
                ? colors.textMuted : colors.border }]} />)}
        </View>
        <Text style={styles.range}>{done}/{chapters.length}</Text>
        <Pressable testID="reader-tongdok-complete" accessibilityRole="checkbox"
          accessibilityLabel="통독 완료" accessibilityState={{ checked, disabled }}
          disabled={disabled} onPress={onToggle} style={styles.button}>
          <View style={[styles.checkbox, { borderColor: colors.accent,
            backgroundColor: checked ? colors.accent : 'transparent' }]}>
            {checked && <Ionicons name="checkmark" size={11} color={colors.onAccent} />}
          </View>
          <Text style={styles.text}>{state.busy ? '저장 중' : checked ? '완료됨' : '통독 완료'}</Text>
        </Pressable>
      </View>
      {state.loading && <Text style={styles.range}>통독 정보를 불러오는 중</Text>}
      {!state.loading && !state.detail && !state.error && (
        <Text style={styles.range}>현재 장은 선택한 통독 범위 밖입니다.</Text>
      )}
      {state.error && <View accessibilityLiveRegion="polite">
        <Text style={styles.range}>{state.error === 'guest'
          ? '통독을 기록하려면 로그인해 주세요.'
          : '통독 정보를 처리하지 못했습니다. 다시 시도해 주세요.'}</Text>
        <Pressable testID="reader-tongdok-retry" accessibilityRole="button"
          onPress={state.error === 'guest' ? onLogin : onRetry} style={styles.button}>
          <Text style={styles.text}>{state.error === 'guest' ? '로그인' : '다시 시도'}</Text>
        </Pressable>
      </View>}
      {state.completedNotice && <Text accessibilityLiveRegion="polite" style={styles.range}
        testID="reader-tongdok-completed">선택한 날짜의 통독을 완료했습니다.</Text>}
      {state.allCompleted ? <Text style={styles.range}>모든 통독 일정을 완료했습니다.</Text> : state.completedNotice && (
        <Pressable testID="reader-tongdok-next" accessibilityRole="button" disabled={state.busy}
          onPress={onNext} style={styles.button}>
          <Text style={styles.text}>다음 미완료 일정</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useNativeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  range: { fontFamily: 'Pretendard-Regular', color: colors.textSecondary, fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { flex: 1, flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 4, justifyContent: 'center' },
  text: { fontFamily: 'Pretendard-Medium', color: colors.accent, fontSize: 11 },
});
