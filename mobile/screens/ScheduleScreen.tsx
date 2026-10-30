import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { useNativeColors } from '../components/ui/tokens';
import { ScheduleDay } from '../components/schedule/ScheduleDay';
import { ScheduleDialog, type ScheduleConfirmation } from '../components/schedule/ScheduleDialog';
import { ScheduleIcon } from '../components/schedule/ScheduleIcon';
import { SchedulePlanSheet } from '../components/schedule/SchedulePlanSheet';
import { scheduleStyles } from '../components/schedule/scheduleStyles';
import {
  formatScheduleDate, groupByDate, monthSummary, parseScheduleMonth, parseSchedulePlans,
  parseSchedulePosition, parseScheduleYear, pickDefaultPlan, planFromScheduleUrl,
  scheduleReaderUrl, scheduleSelectionKey, scheduleTitle, sortSchedules,
  type MonthProgress, type PlanSubscription, type ScheduleEntry,
} from '../api/scheduleData';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type LoadError = 'request' | 'login' | null;
const todayKey = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const currentMonth = () => {
  const date = todayKey();
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
};
const openLogin = () => {
  if (navigationRef.isReady()) navigationRef.navigate('Login');
};

export default function ScheduleScreen({ onRead: onReadSelection, onClose, initialPlanId }: {
  readonly onRead?: (url: string) => void;
  readonly onClose?: () => void;
  readonly initialPlanId?: number | null;
} = {}) {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack } = useAppStack();
  const route = useRoute<RouteProp<TabParamList, 'Schedule'>>();
  const colors = useNativeColors();
  const styles = useMemo(() => scheduleStyles(colors), [colors]);
  const tabBarInset = useNativeTabBarInset();
  const [subscriptions, setSubscriptions] = useState<PlanSubscription[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(currentMonth);
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [monthProgress, setMonthProgress] = useState<Record<string, MonthProgress>>({});
  const [yearProgress, setYearProgress] = useState<{
    plan: number; year: number; months: Record<number, MonthProgress>;
  } | null>(null);
  const [plansError, setPlansError] = useState<LoadError>(null);
  const [schedulesError, setSchedulesError] = useState<LoadError>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [confirmation, setConfirmation] = useState<ScheduleConfirmation | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const topVisible = useRef(false);
  const savingRef = useRef(false);
  const navigatingRef = useRef(false);
  const listRef = useRef<ScrollView>(null);
  const listHeight = useRef(0);
  const monthRowRef = useRef<ScrollView>(null);
  const monthWidth = useRef(0);
  const monthLayouts = useRef<Record<number, { x: number; width: number }>>({});
  const cardLayouts = useRef<Record<string, { y: number; height: number }>>({});
  const identity = useMemo(() => ({}), [status, accessToken, apiFetch, stack.api, stack.web]);
  const context = useMemo(() => ({ identity, plan: selectedPlanId, ...cursor }),
    [identity, selectedPlanId, cursor.year, cursor.month]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const mounted = useRef(true);
  const plansIdentity = useRef<object | null>(null);
  const handledUrl = useRef<string | undefined>(undefined);
  const plansGeneration = useRef(0);
  const monthGeneration = useRef(0);
  const navigationGeneration = useRef(0);
  const loadedContext = useRef<typeof context | null>(null);
  const pendingDate = useRef<{ identity: object; plan: number | null; date: string; initial?: boolean } | null>(null);
  const selectionKey = status === 'signedIn' ? scheduleSelectionKey(stack.api, accessToken) : null;
  const progressKey = (month: number) => `${selectedPlanId}:${cursor.year}:${month}`;

  const revealSelectedMonth = useCallback(() => {
    const layout = monthLayouts.current[cursor.month];
    if (layout && monthWidth.current > 0) {
      monthRowRef.current?.scrollTo({
        x: Math.max(layout.x - monthWidth.current / 2 + layout.width / 2, 0), animated: false,
      });
    }
  }, [cursor.month]);
  useEffect(revealSelectedMonth, [revealSelectedMonth]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setSubscriptions(null);
    setSelectedPlanId(null);
    setCursor(currentMonth());
    setMonthProgress({});
    setYearProgress(null);
    setPlansError(null);
    setShowPlanModal(false);
    handledUrl.current = undefined;
  }, [identity]);
  useEffect(() => {
    cardLayouts.current = {};
    loadedContext.current = null;
    setSchedules(null);
    setSchedulesError(null);
    setBulkMode(false);
    setRangeStart(null);
    setRangeEnd(null);
    setConfirmation(null);
    savingRef.current = false;
    setSaving(false);
    navigatingRef.current = false;
    setNavigating(false);
    topVisible.current = false;
    setShowTop(false);
    const pending = pendingDate.current;
    if (pending && (pending.identity !== identity || pending.plan !== selectedPlanId
      || pending.date.slice(0, 7) !== `${cursor.year}-${String(cursor.month).padStart(2, '0')}`)) {
      pendingDate.current = null;
    }
  }, [context]);

  const loadPlans = useCallback(async () => {
    const generation = ++plansGeneration.current;
    const live = () => mounted.current && liveContext.current.identity === identity
      && generation === plansGeneration.current;
    setPlansError(null);
    try {
      const res = await apiFetch('/api/v1/todos/plan/');
      if (!live()) return;
      if (!res.ok) {
        setPlansError(res.status === 401 ? 'login' : 'request');
        return;
      }
      const subs = parseSchedulePlans(await res.json());
      let remembered: number | null = null;
      if (selectionKey) {
        try {
          const stored = await AsyncStorage.getItem(selectionKey);
          remembered = stored === null ? null : Number(stored);
        } catch (error) {
          console.warn('[Schedule] plan selection read failed:', error);
        }
      }
      if (!live()) return;
      const initial = plansIdentity.current !== identity;
      const urlChanged = handledUrl.current !== route.params?.url;
      const entryPlan = initialPlanId === undefined ? planFromScheduleUrl(route.params?.url) : initialPlanId;
      const urlPlan = initial || urlChanged ? entryPlan : null;
      const current = initial ? null : liveContext.current.plan;
      const selected = subs.find(sub => sub.plan_id === urlPlan)
        ?? subs.find(sub => sub.plan_id === current)
        ?? (status === 'signedIn' ? subs.find(sub => sub.plan_id === remembered) : undefined)
        ?? pickDefaultPlan(subs);
      plansIdentity.current = identity;
      handledUrl.current = route.params?.url;
      setSubscriptions(subs);
      setSelectedPlanId(selected?.plan_id ?? null);
      if (initial && selected) {
        pendingDate.current = { identity, plan: selected.plan_id, date: todayKey(), initial: true };
      }
    } catch (error) {
      if (!live()) return;
      console.error('[Schedule] plans load failed:', error);
      setPlansError('request');
    }
  }, [apiFetch, identity, initialPlanId, route.params?.url, selectionKey, status]);
  useFocusEffect(useCallback(() => {
    if (status !== 'loading') void loadPlans();
    return () => { plansGeneration.current++; };
  }, [status, loadPlans]));

  const loadSchedules = useCallback(async () => {
    if (selectedPlanId === null || status === 'loading' || savingRef.current
      || plansIdentity.current !== identity) return;
    const generation = ++monthGeneration.current;
    const live = () => mounted.current && liveContext.current === context
      && generation === monthGeneration.current;
    setSchedulesError(null);
    try {
      const res = await apiFetch(
        `/api/v1/todos/schedules/month/?plan_id=${selectedPlanId}&month=${cursor.month}&year=${cursor.year}`,
      );
      if (!live()) return;
      if (!res.ok) {
        setSchedulesError(res.status === 401 ? 'login' : 'request');
        return;
      }
      const list = parseScheduleMonth(await res.json());
      if (!live()) return;
      loadedContext.current = context;
      setSchedules(list);
      const pending = pendingDate.current;
      if (pending && !list.some(s => s.date === pending.date)) {
        pendingDate.current = null;
        if (!pending.initial) Alert.alert('일정 안내', '해당 날짜에 등록된 일정이 없어요.');
      }
    } catch (error) {
      if (!live()) return;
      console.error('[Schedule] month load failed:', error);
      setSchedulesError('request');
    }
  }, [apiFetch, context, status]);
  useFocusEffect(useCallback(() => {
    void loadSchedules();
    return () => { monthGeneration.current++; navigationGeneration.current++; };
  }, [loadSchedules]));
  useFocusEffect(useCallback(() => () => {
    pendingDate.current = null;
    navigatingRef.current = false;
    setNavigating(false);
    setConfirmation(null);
  }, []));

  // One annual summary, not eleven extra monthly requests. Unknown is not empty.
  useEffect(() => {
    if (selectedPlanId === null || status === 'loading' || plansIdentity.current !== identity) return;
    let cancelled = false;
    const plan = selectedPlanId;
    const year = cursor.year;
    void (async () => {
      try {
        const res = await apiFetch(`/api/v1/todos/stats/progress/?plan_id=${plan}&year=${year}`);
        if (!res.ok) throw new Error(`year progress ${res.status}`);
        const months = parseScheduleYear(await res.json());
        if (!cancelled && mounted.current && liveContext.current.identity === identity) {
          setYearProgress({ plan, year, months });
        }
      } catch (error) {
        if (!cancelled) console.warn('[Schedule] year progress unavailable:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPlanId, cursor.year, identity]);
  const dayGroups = useMemo(() => Object.entries(groupByDate(sortSchedules(schedules ?? [])))
    .map(([date, entries]) => ({ date, schedules: entries })), [schedules]);
  const summary = useMemo(() => monthSummary(groupByDate(schedules ?? [])), [schedules]);
  useEffect(() => {
    if (schedules === null || loadedContext.current !== context) return;
    setMonthProgress(prev => ({ ...prev, [progressKey(cursor.month)]: {
      done: schedules.filter(s => s.is_completed).length, total: schedules.length,
    } }));
  }, [schedules, context]);
  const yearMonths = yearProgress?.plan === selectedPlanId && yearProgress.year === cursor.year
    ? yearProgress.months : null;
  const nextMonth = yearMonths === null ? undefined : MONTHS.find(month =>
    month > cursor.month && (monthProgress[progressKey(month)] ?? yearMonths[month])?.total > 0);
  const selectedPlan = subscriptions?.find(sub => sub.plan_id === selectedPlanId);
  const defaultPlanName = subscriptions?.find(sub => sub.is_default)?.plan_name
    ?? selectedPlan?.plan_name;
  const controlsDisabled = saving || subscriptions === null || plansError !== null || status === 'loading';
  const quickDisabled = controlsDisabled || selectedPlanId === null || schedules === null
    || schedulesError !== null || navigating;
  useEffect(() => {
    if (!selectionKey || selectedPlanId === null || plansIdentity.current !== identity) return;
    void AsyncStorage.setItem(selectionKey, String(selectedPlanId)).catch(error => {
      console.warn('[Schedule] plan selection save failed:', error);
      if (mounted.current && liveContext.current.identity === identity) {
        Alert.alert('저장 오류', '플랜 선택을 저장하지 못했어요. 다음에 다시 선택해 주세요.');
      }
    });
  }, [selectionKey, selectedPlanId, identity]);

  const scrollToDate = (date: string) => {
    const layout = cardLayouts.current[date];
    if (layout && listHeight.current > 0) {
      listRef.current?.scrollTo({
        y: Math.max(layout.y - (listHeight.current - tabBarInset) / 2 + layout.height / 2, 0), animated: false,
      });
      pendingDate.current = null;
    }
  };
  const jumpToDate = (date: string) => {
    pendingDate.current = { identity, plan: selectedPlanId, date };
    const [year, month] = date.split('-').map(Number);
    if (year !== cursor.year || month !== cursor.month) { setCursor({ year, month }); return; }
    if (loadedContext.current === context) {
      if (schedules?.some(s => s.date === date)) scrollToDate(date);
      else {
        pendingDate.current = null;
        Alert.alert('일정 안내', '해당 날짜에 등록된 일정이 없어요.');
      }
    }
  };
  const selectMonth = (month: number) => {
    if (savingRef.current) return;
    navigationGeneration.current++;
    navigatingRef.current = false;
    setNavigating(false);
    pendingDate.current = null;
    setCursor(c => ({ year: c.year, month }));
    listRef.current?.scrollTo({ y: 0, animated: false });
  };
  const scrollToLastIncomplete = async () => {
    if (quickDisabled || navigatingRef.current) return;
    const generation = ++navigationGeneration.current;
    navigatingRef.current = true;
    setNavigating(true);
    const live = () => mounted.current && liveContext.current === context
      && generation === navigationGeneration.current;
    try {
      const res = await apiFetch(`/api/v1/todos/next-position/?plan_id=${selectedPlanId}`);
      if (!res.ok) throw new Error(`next-position ${res.status}`);
      const position = parseSchedulePosition(await res.json());
      if (!live()) return;
      if (!position.date || position.status === 'no_schedule') {
        Alert.alert('일정 안내', position.message ?? (position.status === 'all_completed'
          ? '모든 일정을 완료했어요.' : '이동할 일정이 없어요.'));
        return;
      }
      if (position.status === 'all_completed') Alert.alert('일정 안내', position.message ?? '모든 일정을 완료했어요.');
      jumpToDate(position.date);
    } catch (error) {
      if (live()) {
        console.error('[Schedule] position load failed:', error);
        Alert.alert('오류', '이동할 일정을 불러오지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      if (live()) { navigatingRef.current = false; setNavigating(false); }
    }
  };
  const promptLogin = () => setConfirmation({
    title: '로그인 필요', description: '읽음 표시를 기록하려면 로그인이 필요해요.',
    confirmText: '로그인', login: true,
    onConfirm: () => {
      if (mounted.current && liveContext.current.identity === identity) openLogin();
    },
  });
  const applyUpdate = async (ids: number[], complete: boolean) => {
    if (status !== 'signedIn' || selectedPlanId === null || ids.length === 0 || savingRef.current) return false;
    const live = () => mounted.current && liveContext.current === context;
    const previous = schedules;
    savingRef.current = true;
    monthGeneration.current++;
    setSaving(true);
    setSchedules((schedules ?? []).map(s => ids.includes(s.id) ? { ...s, is_completed: complete } : s));
    try {
      const res = await apiFetch('/api/v1/todos/reading/update/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: selectedPlanId, schedule_ids: ids, action: complete ? 'complete' : 'cancel' }),
      });
      if (res.status === 401 && live()) { setSchedules(previous); promptLogin(); return false; }
      if (!res.ok) throw new Error(`update ${res.status}`);
      const result: unknown = await res.json();
      if (typeof result !== 'object' || result === null || !('success' in result) || result.success !== true) {
        throw new Error('update rejected');
      }
      return live();
    } catch (error) {
      if (!live()) return false;
      console.error('[Schedule] progress update failed:', error);
      setSchedules(previous);
      Alert.alert('오류', '읽기 상태를 저장하지 못했어요. 다시 시도해 주세요.');
      return false;
    } finally {
      if (live()) { savingRef.current = false; setSaving(false); }
    }
  };
  const selectRange = (date: string) => {
    if (!rangeStart || rangeEnd) { setRangeStart(date); setRangeEnd(null); }
    else {
      setRangeStart(date < rangeStart ? date : rangeStart);
      setRangeEnd(date < rangeStart ? rangeStart : date);
    }
  };
  const onRead = (schedule: ScheduleEntry) => {
    if (savingRef.current) return;
    if (bulkMode) { selectRange(schedule.date); return; }
    if (selectedPlanId === null) return;
    const url = scheduleReaderUrl(schedule, selectedPlanId);
    if (!url) return;
    setConfirmation({
      title: '본문 페이지로 이동할까요?',
      description: `${schedule.date} · ${scheduleTitle(schedule)}\n\n읽음 표시는 왼쪽 체크 또는 ‘일괄수정’으로 바꿀 수 있어요.`,
      confirmText: '이동',
      onConfirm: () => {
        if (mounted.current && liveContext.current === context) {
          if (onReadSelection) onReadSelection(url);
          else if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Bible', params: { url } });
        }
      },
    });
  };
  const onToggle = (items: readonly ScheduleEntry[]) => {
    if (savingRef.current || items.length === 0) return;
    if (bulkMode) { selectRange(items[0].date); return; }
    if (status !== 'signedIn') { promptLogin(); return; }
    void applyUpdate(items.map(s => s.id), !items.every(s => s.is_completed));
  };
  const inRange = (date: string) => rangeStart !== null && date >= rangeStart && date <= (rangeEnd ?? rangeStart);
  const rangeIds = (schedules ?? []).filter(s => inRange(s.date)).map(s => s.id);
  const exitBulk = () => { setBulkMode(false); setRangeStart(null); setRangeEnd(null); };
  const applyRange = async (complete: boolean) => {
    if (rangeStart && rangeEnd && await applyUpdate(rangeIds, complete)) exitBulk();
  };
  const selectPlan = (plan: PlanSubscription) => {
    if (savingRef.current) return;
    navigationGeneration.current++;
    navigatingRef.current = false;
    setNavigating(false);
    pendingDate.current = null;
    setSelectedPlanId(plan.plan_id);
    setShowPlanModal(false);
  };
  const error = plansError ?? schedulesError;
  const loading = status === 'loading' || (subscriptions === null && !plansError)
    || (selectedPlanId !== null && schedules === null && !schedulesError && !plansError);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FAF8F5' }]} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} accessibilityRole="button" accessibilityLabel="뒤로 가기"
          onPress={() => {
            if (onClose) onClose();
            else if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Home' });
          }}>
          <ScheduleIcon name="back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>성경통독표</Text>
        <TouchableOpacity testID="schedule-header-action" accessibilityRole="button"
          accessibilityState={{ disabled: saving || status === 'loading', selected: bulkMode }}
          style={[styles.headerPill, bulkMode && styles.headerPillActive, (saving || status === 'loading') && styles.disabled]}
          disabled={saving || status === 'loading'}
          onPress={() => status !== 'signedIn' ? promptLogin() : bulkMode ? exitBulk() : setBulkMode(true)}>
          <Text style={[styles.headerPillText, bulkMode && styles.headerPillTextActive]}>
            {status === 'signedIn' ? bulkMode ? '완료' : '일괄수정' : '로그인'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.fixedControls}>
        <View style={styles.topRow}>
          <TouchableOpacity testID="schedule-plan-selector" accessibilityRole="button"
            accessibilityState={{ expanded: showPlanModal, disabled: controlsDisabled }}
            style={[styles.planChip, controlsDisabled && styles.disabled]} disabled={controlsDisabled}
            onPress={() => setShowPlanModal(true)}>
            <Text style={styles.planChipText} numberOfLines={1}>{selectedPlan?.plan_name ?? '플랜 선택'}</Text>
            <ScheduleIcon name="down" size={16} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.quickNav}>
            <TouchableOpacity testID="schedule-today" accessibilityRole="button" accessibilityLabel="오늘 일정으로 이동"
              style={[styles.quickButton, quickDisabled && styles.disabled]} disabled={quickDisabled}
              onPress={() => { if (!quickDisabled) { navigationGeneration.current++; jumpToDate(todayKey()); } }}>
              <ScheduleIcon name="calendar" size={13} color={colors.accent} />
              <Text style={styles.quickButtonText}>오늘</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="schedule-last-incomplete" accessibilityRole="button"
              accessibilityLabel="마지막 미완료 일정으로 이동" accessibilityState={{ busy: navigating, disabled: quickDisabled }}
              style={[styles.quickButton, quickDisabled && styles.disabled]} disabled={quickDisabled}
              onPress={() => void scrollToLastIncomplete()}>
              <ScheduleIcon name="list" size={13} color={colors.accent} />
              <Text style={styles.quickButtonText}>마지막 미완료</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView ref={monthRowRef} horizontal style={styles.monthStrip}
          showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}
          onLayout={event => { monthWidth.current = event.nativeEvent.layout.width; revealSelectedMonth(); }}
          onContentSizeChange={revealSelectedMonth}>
          {MONTHS.map(month => {
            const active = month === cursor.month;
            const progress = monthProgress[progressKey(month)] ?? yearMonths?.[month];
            const completed = progress && progress.total > 0 && progress.done === progress.total;
            const partial = progress && progress.done > 0 && !completed;
            return (
              <TouchableOpacity key={month} testID={`schedule-month-${month}`} accessibilityRole="button"
                accessibilityLabel={progress ? `${month}월, ${progress.total}개 중 ${progress.done}개 완료` : `${month}월`}
                accessibilityState={{ selected: active, disabled: saving }}
                style={[styles.monthChip, active && styles.monthChipActive, saving && styles.disabled]}
                onLayout={event => {
                  monthLayouts.current[month] = event.nativeEvent.layout;
                  if (active) revealSelectedMonth();
                }} onPress={() => selectMonth(month)} disabled={saving}>
                <Text style={[styles.monthChipText, progress?.total === 0 && styles.monthChipEmpty,
                  active && styles.monthChipTextActive]}>{month}월</Text>
                {progress && <View style={[styles.monthDot,
                  { backgroundColor: completed ? colors.accent : colors.border },
                  partial && styles.partialDot,
                  active && { backgroundColor: colors.onAccent, opacity: completed ? 1 : partial ? 0.7 : 0.45 }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {bulkMode && <View style={styles.bulkBar} accessibilityState={{ busy: saving }}>
          <Text style={styles.bulkBarText} accessibilityLiveRegion="polite">
            {!rangeStart ? '첫번째 일정을 선택해주세요' : !rangeEnd
              ? `${rangeStart}부터 · 두번째 일정을 선택해주세요`
              : `${rangeStart} ~ ${rangeEnd} · ${rangeIds.length}개 일정을`}
          </Text>
          {rangeStart && rangeEnd && <View style={styles.bulkBarActions}>
            <TouchableOpacity testID="schedule-bulk-complete" accessibilityRole="button"
              style={[styles.bulkButton, saving && styles.disabled]} disabled={saving} onPress={() => void applyRange(true)}>
              <ScheduleIcon name="check" size={16} color={colors.onAccent} />
              <Text style={styles.bulkButtonText}>읽음</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="schedule-bulk-cancel" accessibilityRole="button"
              style={[styles.bulkButton, styles.bulkButtonSecondary, saving && styles.disabled]}
              disabled={saving} onPress={() => void applyRange(false)}>
              <ScheduleIcon name="close" size={16} color={colors.accent} />
              <Text style={[styles.bulkButtonText, { color: colors.accent }]}>읽지 않음</Text>
            </TouchableOpacity>
            <Text style={styles.bulkBarText}>으로 기록</Text>
          </View>}
        </View>}
        {status === 'signedOut' && subscriptions !== null && !plansError && defaultPlanName && (
          <View testID="schedule-guest-notice" style={styles.guestNotice}>
            <Text style={styles.guestNoticeText}>비로그인 상태에서는 <Text style={styles.guestNoticeStrong}>
              {defaultPlanName}</Text>이 기본으로 표시돼요. 읽음 표시는 로그인 후 기록됩니다.</Text>
          </View>
        )}
      </View>
      {/* This is the only vertical page scroller; controls stay above it. */}
      <ScrollView ref={listRef} testID="schedule-list" style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarInset + (showTop ? 68 : 0) }]}
        onLayout={event => {
          listHeight.current = event.nativeEvent.layout.height;
          if (pendingDate.current) scrollToDate(pendingDate.current.date);
        }} scrollEventThrottle={16}
        onScroll={event => {
          const visible = event.nativeEvent.contentOffset.y > 300;
          if (visible !== topVisible.current) { topVisible.current = visible; setShowTop(visible); }
        }}>
        {loading ? <View testID="schedule-loading" accessibilityLabel="일정 불러오는 중" accessibilityState={{ busy: true }}>
          {Array.from({ length: 7 }, (_, i) => <View key={i} style={[styles.card, { height: 74 }]} accessible={false}>
            <View style={[styles.skeleton, { width: 64, height: 12, marginLeft: 40, marginTop: 6 }]} />
            <View style={[styles.skeleton, { width: '55%', height: 18, marginLeft: 40, marginTop: 10 }]} />
          </View>)}
        </View> : error ? (
          <View testID="schedule-error" style={styles.stateBox} accessibilityRole="alert">
            <Text style={styles.emptyText}>{error === 'login' ? '로그인이 필요해요.'
              : plansError ? '플랜을 불러오지 못했어요. 다시 시도해 주세요.' : '일정을 불러오지 못했어요. 다시 시도해 주세요.'}</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.retryButton}
              onPress={() => error === 'login' ? openLogin() : void (plansError ? loadPlans() : loadSchedules())}>
              <Text style={styles.retryButtonText}>{error === 'login' ? '로그인' : '다시 시도'}</Text>
            </TouchableOpacity>
          </View>
        ) : selectedPlanId === null ? (
          <View testID="schedule-no-plan" style={styles.stateBox}>
            <ScheduleIcon name="calendar" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>플랜을 선택해주세요</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={() => setShowPlanModal(true)}>
              <Text style={styles.retryButtonText}>플랜 선택</Text>
            </TouchableOpacity>
          </View>
        ) : <>
          <View style={styles.monthSummary}>
            <View style={styles.monthSummaryRow}>
              <Text style={styles.monthSummaryTitle}>{cursor.year}년 {cursor.month}월</Text>
              <Text style={styles.monthSummaryStat}>{summary.completedDays}/{summary.totalDays}일 완료 · {summary.percent}%</Text>
            </View>
            <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="이번 달 읽기 진도"
              accessibilityValue={{ min: 0, max: summary.totalDays || 1, now: summary.completedDays }}>
              <View style={[styles.progressFill, { width: `${summary.percent}%` }]} />
            </View>
          </View>
          {dayGroups.length === 0 ? <View testID="schedule-empty" style={styles.stateBox}>
            <Text style={styles.emptyText}>{cursor.month}월에 등록된 일정이 없습니다.</Text>
          </View> : dayGroups.map(group => <ScheduleDay key={group.date} {...group} today={todayKey()}
            bulkMode={bulkMode} selected={inRange(group.date)} disabled={saving}
            onRead={onRead} onToggle={onToggle}
            onLayout={event => {
              if (liveContext.current !== context || loadedContext.current !== context) return;
              cardLayouts.current[group.date] = event.nativeEvent.layout;
              if (pendingDate.current?.date === group.date) scrollToDate(group.date);
            }} />)}
          {dayGroups.length > 0 && yearMonths !== null && <View style={styles.continuation}>
            {nextMonth ? <TouchableOpacity testID="schedule-next-month" accessibilityRole="button"
              style={[styles.retryButton, { flexDirection: 'row', gap: 8 }]} disabled={saving}
              onPress={() => selectMonth(nextMonth)}>
              <Text style={styles.retryButtonText}>다음 통독 일정으로</Text>
              <ScheduleIcon name="next" size={16} color={colors.accent} />
            </TouchableOpacity> : <Text style={styles.emptyText}>이 시점 이후로는 더 이상 일정이 없어요</Text>}
          </View>}
        </>}
        <View style={{ height: 40 }} />
      </ScrollView>
      {showTop && <View style={[styles.topButton, { bottom: tabBarInset + 20 }]}>
        <TouchableOpacity style={styles.topTarget} accessibilityRole="button" accessibilityLabel="맨 위로"
          onPress={() => listRef.current?.scrollTo({ y: 0, animated: false })}>
          <ScheduleIcon name="up" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>}
      <SchedulePlanSheet visible={showPlanModal} plans={subscriptions ?? []} selectedPlanId={selectedPlanId}
        onClose={() => setShowPlanModal(false)} onSelect={selectPlan}
        onManage={() => {
          setShowPlanModal(false);
          if (navigationRef.isReady()) navigationRef.navigate('WebView', { url: `${stack.web}/plans` });
        }} />
      <ScheduleDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
      </View>
    </SafeAreaView>
  );
}
