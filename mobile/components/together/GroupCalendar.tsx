import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiFetch } from '../../api/nativeApi';
import { fetchGroupSchedules } from '../../api/togetherData';
import { bookName } from '../../api/bibleBooks';
import { GroupIconButton } from './GroupControls';
import { NativeStateView } from '../ui/NativeStateView';
import { typography, useNativeColors } from '../ui/tokens';
import { dateKey } from './activity';
import { useTogetherResource } from './useTogetherResource';

export function GroupCalendar({ apiFetch, planId }: { readonly apiFetch: ApiFetch; readonly planId: number }) {
  const colors = useNativeColors();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;
  const resource = useTogetherResource(useCallback(
    () => fetchGroupSchedules(apiFetch, { planId, year, month: monthNumber }),
    [apiFetch, planId, year, monthNumber],
  ));
  const start = new Date(year, monthNumber - 1, 1).getDay();
  const today = dateKey(new Date());
  return (
    <View style={styles.content}>
      <View style={styles.navigation}>
        <GroupIconButton label="이전 달" icon="chevron-left" onPress={() => setMonth(new Date(year, monthNumber - 2, 1))} />
        <Text accessibilityRole="header" style={[styles.month, { color: colors.text }]}>{year}년 {monthNumber}월</Text>
        <GroupIconButton label="다음 달" icon="chevron-right" onPress={() => setMonth(new Date(year, monthNumber, 1))} />
      </View>
      {resource.status === 'loading' && <NativeStateView kind="loading" message="일정을 불러오는 중" />}
      {resource.status === 'error' && <NativeStateView kind="error" message={resource.error} onRetry={resource.retry} />}
      {resource.status === 'ready' && <>
        <View style={styles.grid}>
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => <Text key={day} style={[styles.weekday, typography.caption, { color: colors.textSecondary }]}>{day}</Text>)}
          {Array.from({ length: 42 }, (_, index) => {
            const date = new Date(year, monthNumber - 1, index - start + 1);
            const key = dateKey(date);
            const current = date.getMonth() === monthNumber - 1;
            const schedules = current ? resource.value.filter((entry) => entry.date === key) : [];
            const completed = schedules.length > 0 && schedules.every((entry) => entry.is_completed === true);
            return <View key={key} style={styles.daySlot}><View style={[styles.day, {
              borderColor: key === today ? colors.accent : colors.border, opacity: current ? 1 : 0.5,
              backgroundColor: completed || !current ? colors.surfaceMuted : key === today || schedules.length ? colors.accentSurface : colors.surface,
            }]}>
              <Text style={[styles.dayNumber, { color: key === today ? colors.accent : colors.text }]}>{date.getDate()}</Text>
              {schedules.map((entry) => <Text key={entry.id} style={[styles.schedule, {
                color: entry.is_completed === true ? colors.textMuted : colors.accent,
                textDecorationLine: entry.is_completed === true ? 'line-through' : 'none',
              }]}>
                {bookName(entry.book)} {entry.start_chapter}{entry.start_chapter !== entry.end_chapter ? `-${entry.end_chapter}` : ''}{entry.book === 'psa' ? '편' : '장'}
              </Text>)}
            </View></View>;
          })}
        </View>
        {!resource.value.length && <NativeStateView kind="empty" message="이 달에는 읽기 일정이 없습니다." />}
      </>}
      <View style={[styles.legend, { backgroundColor: colors.surfaceMuted }]}>
        {['오늘', '완료', '미완료'].map((label, index) => <View key={label} style={styles.legendItem}>
          <View style={[styles.legendIcon, { borderColor: index === 0 ? colors.accent : colors.border,
            backgroundColor: index === 0 ? colors.accentSurface : index === 1 ? colors.surfaceMuted : colors.surface }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>{label}</Text>
        </View>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 16 }, navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  month: { fontFamily: 'Pretendard-SemiBold', fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8 },
  daySlot: { width: '14.2857%', padding: 2 },
  day: { minHeight: 60, flex: 1, padding: 4, borderWidth: 1, borderRadius: 4, gap: 4, alignItems: 'center' },
  dayNumber: { fontFamily: 'Pretendard-Medium', fontSize: 12, fontWeight: '500', lineHeight: 18 },
  schedule: { fontFamily: 'Pretendard-Regular', fontSize: 10.4, lineHeight: 13.52, letterSpacing: -0.4, textAlign: 'center' },
  legend: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, borderRadius: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendIcon: { width: 16, height: 16, borderWidth: 1, borderRadius: 4 },
  legendText: { fontFamily: 'Pretendard-Regular', fontSize: 14, letterSpacing: -0.4 },
});
