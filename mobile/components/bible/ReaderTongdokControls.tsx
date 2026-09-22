import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rangeLabel } from '../../api/bibleBooks';
import type { TongdokState } from '../../api/readerTongdok';

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
  if (!state.context.enabled) return null;
  const checked = state.detail?.rows.every(row => row.complete) ?? false;
  const disabled = state.busy || state.loading || !state.detail;
  return (
    <View style={styles.container} testID="reader-tongdok-context">
      <Text style={styles.title}>
        {state.detail?.name || `통독 플랜 ${state.context.planId ?? ''}`}
        {state.detail?.date || state.context.date ? ` · ${state.detail?.date ?? state.context.date}` : ''}
      </Text>
      {state.detail && <Text style={styles.range}>
        {state.detail.rows.map(row => rangeLabel(row.book, row.start, row.end)).join(' · ')}
      </Text>}
      <View style={styles.actions}>
        <Pressable testID="reader-tongdok-complete" accessibilityRole="checkbox"
          accessibilityLabel="통독 완료" accessibilityState={{ checked, disabled }}
          disabled={disabled} onPress={onToggle} style={styles.button}>
          <Text style={styles.text}>{checked ? '☑' : '☐'} {state.busy ? '저장 중' : '통독 완료'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSchedule} style={styles.button}
          testID="reader-tongdok-schedule">
          <Text style={styles.text}>통독표</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="통독 모드 종료"
          onPress={onExit} style={styles.button}><Text style={styles.text}>종료</Text></Pressable>
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
      {state.completedNotice && <Text accessibilityLiveRegion="polite" style={styles.title}
        testID="reader-tongdok-completed">선택한 날짜의 통독을 완료했습니다.</Text>}
      {state.allCompleted ? <Text style={styles.title}>모든 통독 일정을 완료했습니다.</Text> : (
        <Pressable testID="reader-tongdok-next" accessibilityRole="button" disabled={state.busy}
          onPress={onNext} style={styles.button}>
          <Text style={styles.text}>다음 미완료 일정</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#FAF8F5', borderBottomWidth: 1, borderColor: '#E9E4DE' },
  title: { fontFamily: 'Pretendard-SemiBold', color: '#2A1111', fontSize: 13 },
  range: { fontFamily: 'Pretendard-Regular', color: '#6B625B', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { minWidth: 48, minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' },
  text: { fontFamily: 'Pretendard-Medium', color: '#2A1111', fontSize: 14 },
});
