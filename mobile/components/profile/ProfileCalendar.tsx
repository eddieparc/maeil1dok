import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calendarCells, localDate, readingUrl } from '../../api/profileData';
import { ProfileSheet } from './ProfileSheet';
import { NativeStateView } from '../ui/NativeStateView';
import { ProfileButton, ProfileIcon, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

const labels = { outside: '다른 달', completed: '읽음', today: '오늘', empty: '일정 없음', future: '미래', missed: '미완료' } as const;
export function ProfileCalendar({ state, controller, onRead }: {
  readonly state: ReadyProfile;
  readonly controller: ProfileController;
  readonly onRead: (url: string) => void;
}) {
  const colors = useProfileColors();
  const today = localDate();
  const result = state.calendar;
  const rows = result.kind === 'ready' ? result.data.calendar : [];
  const selected = rows.filter(row => row.date === state.selectedDate);
  const cells = calendarCells(state.month, rows, today);
  const [year, month] = state.month.split('-');
  const dayStyle = (kind: typeof cells[number]['state']) => ({
    backgroundColor: kind === 'completed' ? colors.accent : kind === 'today' ? colors.accentSurface
      : kind === 'future' ? colors.future : 'transparent',
    borderColor: kind === 'today' ? colors.accent : kind === 'missed' || kind === 'empty' ? colors.textMuted : 'transparent',
    borderWidth: 1.5,
    borderStyle: kind === 'missed' || kind === 'empty' ? 'dashed' : 'solid',
  } as const);
  return <View style={styles.section}>
    <View style={styles.header}>
      <Pressable testID="profile-month-previous" accessibilityRole="button" accessibilityLabel="이전 달"
        onPress={() => { void controller.changeMonth(-1); }} style={styles.monthButton}>
        <View style={[styles.monthOutline, { borderColor: colors.border }]} />
        <ProfileIcon name="left" color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[profileText.heading, { color: colors.text }]}>{year}년 {Number(month)}월</Text>
      <Pressable testID="profile-month-next" accessibilityRole="button" accessibilityLabel="다음 달"
        accessibilityState={{ disabled: state.month >= today.slice(0, 7) }} disabled={state.month >= today.slice(0, 7)}
        onPress={() => { void controller.changeMonth(1); }} style={[styles.monthButton, { opacity: state.month >= today.slice(0, 7) ? 0.3 : 1 }]}>
        <View style={[styles.monthOutline, { borderColor: colors.border }]} />
        <ProfileIcon name="right" color={colors.text} />
      </Pressable>
    </View>
    {result.kind === 'loading' && <NativeStateView kind="loading" message="통독 기록을 불러오고 있어요." />}
    {result.kind === 'error' && <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('calendar', true); }} />}
    {result.kind === 'ready' && <>
      {result.data.plans.length > 0 && <View style={styles.planLegend}>
        {result.data.plans.map(plan => <View key={plan.id} style={styles.plan}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={[profileText.caption, { color: colors.textSecondary, flexShrink: 1 }]}>{plan.name}</Text>
        </View>)}
      </View>}
      <View style={styles.grid}>
        <View style={styles.week}>
          {['일', '월', '화', '수', '목', '금', '토'].map(day =>
            <Text key={day} style={[profileText.caption, styles.weekday, { color: colors.textMuted }]}>{day}</Text>)}
        </View>
        {Array.from({ length: 6 }, (_, week) => <View key={week} style={styles.week}>
          {cells.slice(week * 7, week * 7 + 7).map(cell => {
            const disabled = !cell.current || cell.schedules.length === 0;
            return <View key={cell.date} style={styles.slot}>
              <Pressable testID={`profile-day-${cell.date}`} accessibilityRole="button"
                accessibilityElementsHidden={!cell.current} importantForAccessibility={cell.current ? 'auto' : 'no-hide-descendants'}
                accessibilityState={{ disabled, selected: cell.date === state.selectedDate }}
                accessibilityLabel={`${cell.date}, ${labels[cell.state]}, 일정 ${cell.schedules.length}개`}
                disabled={disabled} onPress={() => controller.selectDate(cell.date)}
                style={({ pressed }) => [styles.day, { opacity: cell.current ? 1 : 0,
                  backgroundColor: pressed && !disabled ? colors.hover : 'transparent' }]}>
                <View style={[styles.cell, dayStyle(cell.state)]}>
                  <Text style={[profileText.small, profileText.bold, styles.number, {
                    color: cell.state === 'completed' ? colors.onAccent : cell.state === 'today' ? colors.accent
                      : cell.state === 'future' ? colors.futureText : colors.textMuted,
                  }]}>{cell.day}</Text>
                </View>
              </Pressable>
            </View>;
          })}
        </View>)}
      </View>
      <View style={styles.legend}>
        {(['completed', 'today', 'missed', 'future'] as const).map(kind => <View key={kind} style={styles.legendItem}>
          <View style={[styles.legendIcon, dayStyle(kind)]} />
          <Text style={[profileText.caption, { color: colors.textSecondary }]}>{labels[kind]}</Text>
        </View>)}
      </View>
      {rows.length === 0 && <NativeStateView kind="empty" message="이 달에는 통독 일정이 없어요." />}
    </>}
    <ProfileSheet visible={state.selectedDate !== null} title={state.selectedDate ?? '통독 일정'} onClose={() => controller.selectDate(null)}>
      <View style={styles.schedules}>
        {selected.map(row => {
          const url = readingUrl(row, state.profile.user.id);
          return <View key={row.schedule_id} style={[styles.schedule, { borderColor: colors.border }]}>
            <Text style={[profileText.heading, { color: colors.text }]}>{row.plan_name}</Text>
            <Text style={[profileText.body, { color: colors.text }]}>{row.schedule_text || `${row.book} ${row.chapters}`}</Text>
            <Text style={[profileText.caption, { color: colors.textSecondary }]}>{row.is_completed ? '읽음' : '미완료'}</Text>
            <ProfileButton label="본문 읽기" disabled={url === null} onPress={() => {
              if (url) { controller.selectDate(null); onRead(url); }
            }} />
          </View>;
        })}
      </View>
    </ProfileSheet>
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthOutline: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderRadius: 10 },
  planLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, paddingBottom: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  grid: { marginHorizontal: -12, gap: 6 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6, fontFamily: 'Pretendard-SemiBold' },
  slot: { flex: 1, alignItems: 'center' },
  day: { width: 44, maxWidth: '100%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  cell: { width: 32, height: 32, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  number: { fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendIcon: { width: 12, height: 12, borderRadius: 4 },
  schedules: { gap: 12 },
  schedule: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 8 },
});
