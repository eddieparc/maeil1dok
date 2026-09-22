import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rangeLabel, type BibleReaderRoute } from '../../api/bibleBooks';
import { scheduleTarget, type ReaderTongdok } from '../../api/readerTongdok';
import { shiftMonth, type ScheduleEntry } from '../../api/scheduleData';

interface Props {
  readonly controller: ReaderTongdok;
  readonly onSelect: (route: BibleReaderRoute) => void;
  readonly onClose: () => void;
}
export default function ReaderTongdokSchedule({ controller, onSelect, onClose }: Props) {
  const context = controller.getState().context;
  const [period, setPeriod] = useState(() => {
    const date = context.date ? new Date(`${context.date}T12:00:00`) : new Date();
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
  const [rows, setRows] = useState<readonly ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false); setRows([]);
    controller.month(period.month, period.year).then(result => {
      if (active) { setRows(result); setLoading(false); }
    }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; };
  }, [controller, context.planId, period, retry]);
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.title}>성경 통독표</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="통독표 닫기"
            onPress={onClose} style={styles.button}><Text>닫기</Text></Pressable>
        </View>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 달" style={styles.button}
            onPress={() => setPeriod(shiftMonth(period.year, period.month, -1))}><Text>이전</Text></Pressable>
          <Text style={styles.title}>{period.year}년 {period.month}월</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="다음 달" style={styles.button}
            onPress={() => setPeriod(shiftMonth(period.year, period.month, 1))}><Text>다음</Text></Pressable>
        </View>
        {loading && <ActivityIndicator accessibilityLabel="통독표 불러오는 중" />}
        {failed && <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => setRetry(n => n + 1)}><Text>통독표를 불러오지 못했습니다. 다시 시도</Text></Pressable>}
        {!loading && !failed && rows.length === 0 && <Text style={styles.empty}>이번 달 일정이 없습니다.</Text>}
        <ScrollView>
          {rows.map(row => {
            const target = context.planId === null ? null : scheduleTarget(row, context.planId);
            return <Pressable key={row.id} testID={`reader-tongdok-row-${row.id}`}
              accessibilityRole="button" accessibilityState={{ selected: row.id === context.scheduleId, disabled: !target }}
              style={styles.row} disabled={!target} onPress={() => { if (target) onSelect(target); }}>
              <Text style={styles.title}>{row.date} {row.is_completed ? '완료' : ''}</Text>
              <Text style={styles.range}>{rangeLabel(target?.location?.book ?? row.book, row.start_chapter, row.end_chapter)}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF8F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#1F1A17' },
  range: { fontFamily: 'Pretendard-Regular', color: '#6B625B', marginTop: 6 },
  button: { minWidth: 48, minHeight: 48, justifyContent: 'center', padding: 12 },
  row: { padding: 20, minHeight: 64, borderBottomWidth: 1, borderColor: '#E9E4DE' },
  empty: { padding: 20, color: '#6B625B' },
});
