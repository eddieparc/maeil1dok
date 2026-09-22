import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calendarCells, localDate, readingUrl } from '../../api/profileData';
import { NativeButton } from '../ui/NativeButton';
import { NativeSheet } from '../ui/NativeSheet';
import { NativeStateView } from '../ui/NativeStateView';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

const labels: Record<string, string> = {
  outside: '다른 달', completed: '읽음', today: '오늘', empty: '일정 없음', future: '미래', missed: '미완료',
};
export function ProfileCalendar({ state, controller, onRead }: {
  readonly state: ReadyProfile;
  readonly controller: ProfileController;
  readonly onRead: (url: string) => void;
}) {
  const colors = useNativeColors();
  const today = localDate();
  const result = state.calendar;
  const rows = result.kind === 'ready' ? result.data.calendar : [];
  const selected = rows.filter(row => row.date === state.selectedDate);
  return <View style={styles.section}>
    <View style={styles.header}>
      <NativeButton label="이전" accessibilityLabel="이전 달" onPress={() => { void controller.changeMonth(-1); }} />
      <Text accessibilityRole="header" style={[typography.label, { color: colors.text, flex: 1, textAlign: 'center' }]}>
        {state.month.replace('-', '년 ')}월
      </Text>
      <NativeButton label="다음" accessibilityLabel="다음 달" disabled={state.month >= today.slice(0, 7)}
        onPress={() => { void controller.changeMonth(1); }} />
    </View>
    {result.kind === 'loading' && <NativeStateView kind="loading" message="통독 기록을 불러오고 있어요." />}
    {result.kind === 'error' && <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('calendar', true); }} />}
    {result.kind === 'ready' && <>
      <View style={styles.legend}>
        {result.data.plans.map(plan => <Text key={plan.id} style={[typography.caption, { color: colors.textSecondary }]}>{plan.name}</Text>)}
      </View>
      <View style={styles.grid}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day =>
          <Text key={day} style={[styles.weekday, typography.caption, { color: colors.textSecondary }]}>{day}</Text>)}
        {calendarCells(state.month, rows, today).map(cell => {
          const completed = cell.state === 'completed';
          const disabled = !cell.current || cell.schedules.length === 0;
          return <Pressable key={cell.date} testID={`profile-day-${cell.date}`}
            accessibilityRole="button" accessibilityState={{ disabled, selected: cell.date === state.selectedDate }}
            accessibilityLabel={`${cell.date}, ${labels[cell.state]}, 일정 ${cell.schedules.length}개`}
            disabled={disabled} onPress={() => controller.selectDate(cell.date)}
            style={({ pressed }) => [styles.day, { opacity: cell.current ? 1 : 0.3,
              backgroundColor: pressed && !disabled ? colors.surfacePressed : colors.surface }]}>
            <View style={[styles.circle, {
              backgroundColor: completed ? colors.accent : cell.state === 'missed' ? colors.surfaceMuted : colors.surface,
              borderColor: cell.date === today ? colors.accent : 'transparent', borderWidth: 2,
            }]}>
              <Text style={[typography.caption, { color: completed ? colors.onAccent : colors.text }]}>{cell.day}</Text>
            </View>
          </Pressable>;
        })}
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>읽음 · 오늘 · 미완료 · 미래</Text>
      {rows.length === 0 && <NativeStateView kind="empty" message="이 달에는 통독 일정이 없어요." />}
    </>}
    <NativeSheet visible={state.selectedDate !== null} title={state.selectedDate ?? '통독 일정'} onClose={() => controller.selectDate(null)}>
      <View style={styles.section}>
        {selected.map(row => {
          const url = readingUrl(row);
          return <View key={row.schedule_id} style={[styles.schedule, { borderColor: colors.border }]}>
            <Text style={[typography.label, { color: colors.text }]}>{row.plan_name}</Text>
            <Text style={[typography.body, { color: colors.text }]}>{row.schedule_text || `${row.book} ${row.chapters}`}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{row.is_completed ? '읽음' : '미완료'}</Text>
            <NativeButton label="본문 읽기" disabled={url === null} onPress={() => {
              if (url) { controller.selectDate(null); onRead(url); }
            }} />
          </View>;
        })}
      </View>
    </NativeSheet>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285714%', textAlign: 'center', paddingVertical: spacing.sm },
  day: { width: '14.285714%', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  circle: { minWidth: 36, minHeight: 36, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  schedule: { borderWidth: 1, borderRadius: 12, padding: spacing.lg, gap: spacing.sm },
});
