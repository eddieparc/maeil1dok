import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiFetch } from '../../api/nativeApi';
import { fetchGroupSchedules } from '../../api/togetherData';
import { bookName } from '../../api/bibleBooks';
import { NativeButton } from '../ui/NativeButton';
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
        <NativeButton label="이전 달" onPress={() => setMonth(new Date(year, monthNumber - 2, 1))} />
        <Text accessibilityRole="header" style={[typography.label, { color: colors.text }]}>{year}년 {monthNumber}월</Text>
        <NativeButton label="다음 달" onPress={() => setMonth(new Date(year, monthNumber, 1))} />
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
            return <View key={key} style={[styles.day, { borderColor: key === today ? colors.accent : colors.border, opacity: current ? 1 : 0.4 }]}>
              <Text style={[typography.caption, { color: colors.text }]}>{date.getDate()}</Text>
              {schedules.map((entry) => <Text key={entry.id} style={[styles.schedule, { color: colors.textSecondary }]}>
                {bookName(entry.book)} {entry.start_chapter}{entry.start_chapter !== entry.end_chapter ? `-${entry.end_chapter}` : ''}{entry.book === 'psa' ? '편' : '장'}
                {entry.is_completed === true ? ' · 완료' : ''}
              </Text>)}
            </View>;
          })}
        </View>
        {!resource.value.length && <NativeStateView kind="empty" message="이 달에는 읽기 일정이 없습니다." />}
      </>}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 14 }, navigation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8 },
  day: { width: '14.2857%', minHeight: 72, padding: 3, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  schedule: { fontFamily: 'Pretendard-Regular', fontSize: 11, lineHeight: 16 },
});
