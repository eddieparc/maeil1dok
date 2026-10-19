import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApiFetch } from '../../api/nativeApi';
import { fetchProgress, fetchStats } from '../../api/togetherData';
import { NativeButton } from '../ui/NativeButton';
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
}
export function GroupDetail({ apiFetch, group, signedIn, actionError }: GroupDetailProps) {
  const colors = useNativeColors();
  const [tab, setTab] = useState<'info' | 'calendar' | 'board'>('info');
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
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{group.is_public ? '공개' : '비공개'}{group.my_role === '관리자' ? ' · 관리자' : group.is_member ? ' · 내 그룹' : ''}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{group.member_count}/{group.max_members}명</Text>
        </View>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{group.name}</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{group.description || '설명이 없습니다.'}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>리더 · {group.creator.nickname}</Text>
        <Text style={[typography.label, { color: colors.text }]}>그룹 평균 진도 {average === null ? '-' : `${average}%`}</Text>
        {average !== null && <View accessibilityRole="progressbar" accessibilityLabel="그룹 평균 진도"
          accessibilityValue={{ min: 0, max: 100, now: average }}
          style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, average))}%`, backgroundColor: colors.accent }]} />
        </View>}
        <Text style={[typography.caption, { color: colors.textMuted }]}>{selectedPlan ? `${selectedPlan.name} · 공개된 멤버 기록 기준` : '등록된 읽기표 없음'}</Text>
        {!signedIn && planId !== null && <Text style={[typography.caption, { color: colors.textSecondary }]}>로그인하면 멤버 기록을 볼 수 있어요.</Text>}
        {stats.status === 'loading' && planId !== null && signedIn && <NativeStateView kind="loading" message="진도를 불러오는 중" />}
        {stats.status === 'error' && <NativeStateView kind="error" message={stats.error} onRetry={stats.retry} />}
      </View>
      <View style={styles.tabs}>
        {([{ key: 'info', label: `멤버 ${group.member_count}` }, { key: 'calendar', label: '일정' }, { key: 'board', label: '게시판' }] as const).map(({ key, label }) =>
          <NativeButton key={key} label={label} selected={tab === key} onPress={() => setTab(key)} />)}
      </View>
      {group.plans.length > 1 && <View style={styles.tabs}>
        {group.plans.map((plan) => <NativeButton key={plan.id} label={plan.name} selected={planId === plan.id} onPress={() => setPlanId(plan.id)} />)}
      </View>}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tab === 'info' && <>
          {progress.status === 'loading' && signedIn && planId !== null && <NativeStateView kind="loading" message="주간 기록을 불러오는 중" />}
          {progress.status === 'error' && <NativeStateView kind="error" message={progress.error} onRetry={progress.retry} />}
          <GroupMembers key={`${group.id}:${group.is_member}`} apiFetch={apiFetch} groupId={group.id} today={today}
            stats={stats.status === 'ready' ? stats.value : []} calendar={progress.status === 'ready' ? progress.value : {}} />
        </>}
        {tab === 'calendar' && (planId !== null
          ? <GroupCalendar apiFetch={apiFetch} planId={planId} />
          : <NativeStateView kind="empty" message="등록된 읽기표가 없습니다." />)}
        {tab === 'board' && <NativeStateView kind="empty" message="게시판 준비 중입니다. 아직 그룹 게시판 기능이 제공되지 않습니다." />}
      </View>
      {actionError !== '' && <NativeStateView kind="error" message={actionError} />}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 14 }, card: { padding: 20, borderWidth: 1, borderRadius: 20, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' }, fill: { height: '100%' },
});
