import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiFetch } from '../../api/nativeApi';
import { fetchProgress, fetchStats } from '../../api/togetherData';
import { GroupBadges, GroupButton } from './GroupControls';
import { NativeStateView } from '../ui/NativeStateView';
import { typography, useNativeColors } from '../ui/tokens';
import { averageProgress, dateKey, weekDates } from './activity';
import type { ProgressDay, ReadingGroup } from './contracts';
import { GroupCalendar } from './GroupCalendar';
import { GroupMembers } from './GroupMembers';
import { useTogetherResource } from './useTogetherResource';

export interface GroupDetailProps {
  readonly apiFetch: ApiFetch;
  readonly group: ReadingGroup;
  readonly signedIn: boolean;
  readonly actionError: string;
  readonly onBoard: () => void;
  readonly tab: 'info' | 'calendar';
  readonly onTab: (tab: 'info' | 'calendar') => void;
}
export function GroupDetail({ apiFetch, group, signedIn, actionError, onBoard, tab, onTab }: GroupDetailProps) {
  const colors = useNativeColors();
  const [planId, setPlanId] = useState<number | null>(group.plans[0]?.id ?? null);
  const today = useMemo(() => new Date(), []);
  const stats = useTogetherResource(useCallback(async () => {
    if (!planId || !signedIn) return [];
    return fetchStats(apiFetch, { groupId: group.id, planId });
  }, [apiFetch, group.id, group.is_member, planId, signedIn]));
  const progress = useTogetherResource(useCallback(async (): Promise<Readonly<Record<string, ProgressDay>>> => {
    if (!planId || !signedIn) return {};
    const months = [...new Map(weekDates(today).map((date) => [dateKey(date).slice(0, 7), date])).values()];
    const calendars = await Promise.all(months.map((date) => fetchProgress(apiFetch, {
      groupId: group.id, planId, year: date.getFullYear(), month: date.getMonth() + 1,
    })));
    return Object.fromEntries(calendars.flatMap((calendar) => Object.entries(calendar)));
  }, [apiFetch, group.id, group.is_member, planId, signedIn, today]));
  const average = stats.status === 'ready' ? averageProgress(stats.value) : null;
  const selectedPlan = group.plans.find((plan) => plan.id === planId);
  return (
    <View style={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <GroupBadges isPublic={group.is_public} membership={group.my_role === '관리자' ? '관리자' : group.is_member ? '내 그룹' : undefined} />
          <Text style={[styles.count, { color: colors.textMuted }]}>{group.member_count}/{group.max_members}명</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{group.name}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{group.description || '설명이 없습니다.'}</Text>
        <View style={[styles.progress, { borderTopColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>그룹 평균 진도</Text>
          <Text style={[styles.progressLabel, styles.progressValue, { color: colors.accent }]}>{average === null ? '-' : average}%</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="그룹 평균 진도"
          accessibilityValue={average === null ? { min: 0, max: 100, text: '진도 정보 없음' } : { min: 0, max: 100, now: average }}
          style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, average ?? 0))}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={[styles.progressCaption, { color: colors.textMuted }]}>{selectedPlan ? `${selectedPlan.name} · 공개된 멤버 기록 기준` : '등록된 읽기표 없음'}</Text>
        {!signedIn && planId !== null && <Text style={[typography.caption, { color: colors.textSecondary }]}>로그인하면 멤버 기록을 볼 수 있어요.</Text>}
        {stats.status === 'loading' && planId !== null && signedIn && <NativeStateView kind="loading" message="진도를 불러오는 중" />}
        {stats.status === 'error' && <NativeStateView kind="error" message={stats.error} onRetry={stats.retry} />}
        </View>
      </View>
      <View style={styles.tabs}>
        {([{ key: 'info', label: '멤버' }, { key: 'calendar', label: '일정' }, { key: 'board', label: '게시판' }] as const).map(({ key, label }) =>
          <GroupButton key={key} label={label} variant="chip" selected={tab === key} count={key === 'info' ? group.member_count : undefined}
            onPress={() => { if (key === 'board') onBoard(); else onTab(key); }} />)}
      </View>
      <View style={[styles.card, tab === 'info' && styles.membersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tab === 'info' && <>
          {progress.status === 'loading' && signedIn && planId !== null && <NativeStateView kind="loading" message="주간 기록을 불러오는 중" />}
          {progress.status === 'error' && <NativeStateView kind="error" message={progress.error} onRetry={progress.retry} />}
          <GroupMembers key={`${group.id}:${group.is_member}`} apiFetch={apiFetch} groupId={group.id} today={today}
            stats={stats.status === 'ready' ? stats.value : []} calendar={progress.status === 'ready' ? progress.value : {}} />
        </>}
        {tab === 'calendar' && <View style={styles.calendar}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>읽기 계획 일정</Text>
          {group.plans.length > 1 ? <View style={styles.tabs}>
            {group.plans.map((plan) => <GroupButton key={plan.id} label={plan.name} variant="chip" selected={planId === plan.id} onPress={() => setPlanId(plan.id)} />)}
          </View> : selectedPlan && <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{selectedPlan.name}</Text>}
          {planId !== null ? <GroupCalendar apiFetch={apiFetch} planId={planId} />
            : <NativeStateView kind="empty" message="등록된 읽기표가 없습니다. 그룹에 읽기표가 연결되면 일정을 볼 수 있어요." />}
        </View>}
      </View>
      {actionError !== '' && <NativeStateView kind="error" message={actionError} />}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 14 }, card: { padding: 20, borderWidth: 1, borderRadius: 16 },
  membersCard: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  count: { fontFamily: 'Pretendard-Regular', fontSize: 12, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  title: { fontFamily: 'Pretendard-Bold', fontSize: 22, fontWeight: '700', lineHeight: 28.6, letterSpacing: -0.6, marginTop: 12, marginBottom: 8 },
  description: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
  progress: { borderTopWidth: 1, paddingTop: 14, marginTop: 16, gap: 8 },
  progressLabel: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 19.5, letterSpacing: -0.4 },
  progressValue: { fontFamily: 'Pretendard-Bold', fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressCaption: { fontFamily: 'Pretendard-Regular', fontSize: 11, lineHeight: 16.5, letterSpacing: -0.4 },
  sectionTitle: { fontFamily: 'Pretendard-Bold', fontSize: 15, fontWeight: '700', lineHeight: 19.5, letterSpacing: -0.6 },
  calendar: { gap: 14 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' }, fill: { height: '100%' },
});
