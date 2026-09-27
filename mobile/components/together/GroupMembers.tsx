import { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ApiFetch } from '../../api/nativeApi';
import { fetchMembers } from '../../api/togetherData';
import { NativeStateView } from '../ui/NativeStateView';
import { typography, useNativeColors } from '../ui/tokens';
import { dateKey, weekDates, weekState } from './activity';
import type { MemberStat, ProgressDay } from './contracts';
import { useTogetherResource } from './useTogetherResource';

export function GroupMembers({ apiFetch, groupId, stats, calendar, today }: {
  readonly apiFetch: ApiFetch;
  readonly groupId: number;
  readonly stats: readonly MemberStat[];
  readonly calendar: Readonly<Record<string, ProgressDay>>;
  readonly today: Date;
}) {
  const colors = useNativeColors();
  const resource = useTogetherResource(useCallback(() => fetchMembers(apiFetch, groupId), [apiFetch, groupId]));
  if (resource.status === 'loading') return <NativeStateView kind="loading" message="멤버를 불러오는 중" />;
  if (resource.status === 'error') return <NativeStateView kind="error" message={resource.error} onRetry={resource.retry} />;
  const days = weekDates(today);
  const labels = { upcoming: '예정', completed: '읽음', today: '오늘', pending: '미완료', unavailable: '기록 정보 없음' };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[typography.label, { color: colors.text }]}>이번 주 멤버 현황</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{dateKey(days[0])} ~ {dateKey(days[6])}</Text>
      {!resource.value.members.length && <NativeStateView kind="empty" message="공개된 멤버 정보가 없습니다." />}
      {resource.value.members.map(({ user, role }) => (
        <View key={user.id} style={[styles.member, { borderColor: colors.border }]}>
          <View style={styles.person}>
            {user.profile_image && <Image source={{ uri: user.profile_image }} style={styles.avatar} />}
            <View style={styles.name}>
              <Text style={[typography.label, { color: colors.text }]}>{user.nickname}{role === '관리자' ? ' · 리더' : ''}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>연속 {stats.find((stat) => stat.user.id === user.id)?.current_streak ?? '-'}일</Text>
            </View>
          </View>
          <View style={styles.week}>
            {days.map((date) => {
              const key = dateKey(date);
              const state = weekState(calendar, user.id, { day: key, today: dateKey(today) });
              return <View key={key} accessible accessibilityLabel={`${user.nickname}, ${key}: ${labels[state]}`}
                style={[styles.day, { borderColor: state === 'today' ? colors.accent : colors.border, backgroundColor: state === 'completed' ? colors.accent : colors.surfaceMuted }]}>
                <Text style={[typography.caption, { color: state === 'completed' ? colors.onAccent : colors.textSecondary }]}>{['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}</Text>
              </View>;
            })}
          </View>
        </View>
      ))}
      {resource.value.hasMore && <Text style={[typography.caption, { color: colors.textSecondary }]}>전체 {resource.value.total}명 중 공개된 {resource.value.members.length}명의 멤버를 표시합니다.</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 12 }, member: { gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 }, name: { flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  week: { flexDirection: 'row', gap: 4 }, day: { flex: 1, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 4 },
});
