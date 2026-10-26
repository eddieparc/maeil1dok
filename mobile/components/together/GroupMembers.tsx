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
  const week = Math.ceil((today.getDate() + (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7) / 7);
  const labels = { upcoming: '예정', completed: '읽음', today: '오늘', pending: '미완료', unavailable: '기록 정보 없음' };
  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>이번 주 멤버 현황</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>{today.getMonth() + 1}월 {week}주</Text>
      </View>
      {!resource.value.members.length && <NativeStateView kind="empty" message="공개된 멤버 정보가 없습니다." />}
      {resource.value.members.map(({ user, role }) => (
        <View key={user.id} style={[styles.member, { borderColor: colors.border }]}>
            {user.profile_image ? <Image source={{ uri: user.profile_image }} style={styles.avatar} />
              : <View style={[styles.avatar, styles.placeholder, { backgroundColor: colors.accentSurface }]}>
                <Text style={[styles.initial, { color: colors.accent }]}>{user.nickname.charAt(0) || '?'}</Text>
              </View>}
            <View style={styles.name}>
              <View style={styles.nameRow}>
                <Text style={[styles.nickname, { color: colors.text }]}>{user.nickname}</Text>
                {role === '관리자' && <Text style={[styles.badge, { backgroundColor: colors.accentSurface, color: colors.accent }]}>리더</Text>}
              </View>
              <Text style={[styles.meta, styles.streak, { color: colors.textMuted }]}>연속 {stats.find((stat) => stat.user.id === user.id)?.current_streak ?? '-'}일</Text>
            </View>
          <View style={styles.week}>
            {days.map((date) => {
              const key = dateKey(date);
              const state = weekState(calendar, user.id, { day: key, today: dateKey(today) });
              return <View key={key} accessible accessibilityLabel={`${user.nickname}, ${key}: ${labels[state]}`}
                style={[styles.day, {
                  borderStyle: state === 'upcoming' || state === 'pending' ? 'dashed' : 'solid',
                  borderColor: state === 'today' || state === 'completed' ? colors.accent : state === 'pending' ? colors.textMuted : colors.border,
                  backgroundColor: state === 'completed' ? colors.accent : state === 'today' ? colors.accentSurface
                    : state === 'unavailable' ? colors.surfaceMuted : colors.surface,
                }]} />;
            })}
          </View>
        </View>
      ))}
      {resource.value.hasMore && <Text style={[typography.caption, { color: colors.textSecondary }]}>전체 {resource.value.total}명 중 공개된 {resource.value.members.length}명의 멤버를 표시합니다.</Text>}
      <View style={styles.legend}>
        {(['읽음', '오늘', '예정'] as const).map((label, index) => <View key={label} style={styles.legendItem}>
          <View style={[styles.day, { borderStyle: index === 2 ? 'dashed' : 'solid', borderColor: index === 2 ? colors.border : colors.accent,
            backgroundColor: index === 0 ? colors.accent : index === 1 ? colors.accentSurface : colors.surface }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{label}</Text>
        </View>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: {},
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 18, paddingBottom: 10, paddingHorizontal: 20 },
  heading: { fontFamily: 'Pretendard-Bold', fontSize: 15, fontWeight: '700', letterSpacing: -0.4 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 20, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, minWidth: 0 }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  nickname: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, fontWeight: '600', letterSpacing: -0.4, flexShrink: 1 },
  meta: { fontFamily: 'Pretendard-Regular', fontSize: 12, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  streak: { marginTop: 2 },
  badge: { fontFamily: 'Pretendard-Bold', fontSize: 10, fontWeight: '700', lineHeight: 10, paddingVertical: 3, paddingHorizontal: 5, borderRadius: 999, overflow: 'hidden' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'Pretendard-Bold', fontSize: 13, fontWeight: '700' },
  week: { flexDirection: 'row', gap: 3 }, day: { width: 10, height: 10, borderWidth: 1, borderRadius: 3 },
  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: 'Pretendard-Regular', fontSize: 11, letterSpacing: -0.4 },
});
