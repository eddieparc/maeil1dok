import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { NativeButton } from '../components/ui/NativeButton';
import {
  formatScheduleDate,
  groupByDate,
  monthSummary,
  normalizeMonthSchedules,
  normalizeNextPosition,
  normalizeSubscriptions,
  pickDefaultPlan,
  readingStatus,
  scheduleTitle,
  scheduleReaderUrl,
  sortSchedules,
  type PlanSubscription,
  type ReadingStatus,
  type ScheduleEntry,
} from '../api/scheduleData';

const BG = '#FAF8F5';
const CARD = '#FFFFFF';
const TEXT = '#1F1A17';
const SECONDARY = '#6B625B';
const TERTIARY = '#9B928A';
const BORDER = '#E9E4DE';
const ACCENT = '#2A1111';
const ACCENT_BG = '#F3EEEE';
const ERROR = '#B3261E';
const ERROR_BG = '#FBEBEA';
const PARTIAL = '#B8862B';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const STATUS_TEXT: Record<ReadingStatus, string> = {
  completed: '읽음',
  not_completed: '미완료',
  current: '오늘',
  upcoming: '예정',
};

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const openLogin = () => {
  if (navigationRef.isReady()) navigationRef.navigate('Login');
};

const openWebPath = (webBase: string, path: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('WebView', { url: `${webBase}${path}` });
  }
};

const openBibleChapter = (url: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', {
      screen: 'Bible',
      params: { url },
    });
  }
};

interface DayGroup {
  readonly date: string;
  readonly schedules: ScheduleEntry[];
}

export default function ScheduleScreen() {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack } = useAppStack();

  const [subscriptions, setSubscriptions] = useState<PlanSubscription[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [monthProgress, setMonthProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [plansError, setPlansError] = useState(false);
  const [schedulesError, setSchedulesError] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const topVisible = useRef(false);
  const savingRef = useRef(false);
  const listRef = useRef<ScrollView>(null);
  const cardOffsets = useRef<Record<string, number>>({});
  const tabBarInset = useNativeTabBarInset();
  const identity = useMemo(() => ({}), [status, accessToken, apiFetch, stack.api, stack.web]);
  const context = useMemo(() => ({ identity, plan: selectedPlanId, ...cursor }),
    [identity, selectedPlanId, cursor.year, cursor.month]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const mounted = useRef(true);
  const plansGeneration = useRef(0);
  const monthGeneration = useRef(0);
  const navigationGeneration = useRef(0);
  const loadedContext = useRef<typeof context | null>(null);
  const pendingDate = useRef<{ identity: object; plan: number | null; date: string } | null>(null);
  const progressKey = (month: number) => `${selectedPlanId}:${cursor.year}:${month}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setSubscriptions(null);
    setSelectedPlanId(null);
    setMonthProgress({});
    setShowPlanModal(false);
  }, [identity]);

  useEffect(() => {
    cardOffsets.current = {};
    setSchedules(null);
    setSchedulesError(false);
    setBulkMode(false);
    setRangeStart(null);
    setRangeEnd(null);
    savingRef.current = false;
    setSaving(false);
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
    setPlansError(false);
    try {
      // 웹과 동일: 게스트도 /todos/plan/ (AllowAny — 공개 플랜 반환).
      const res = await apiFetch('/api/v1/todos/plan/');
      if (!res.ok) throw new Error(`plans ${res.status}`);
      const subs = normalizeSubscriptions(await res.json());
      if (!live()) return;
      setSubscriptions(subs);
      setSelectedPlanId((current) => {
        if (current !== null && subs.some((s) => s.plan_id === current)) {
          return current;
        }
        return pickDefaultPlan(subs)?.plan_id ?? subs[0]?.plan_id ?? null;
      });
    } catch (error) {
      if (!live()) return;
      console.error('[Schedule] plans load failed:', error);
      setPlansError(true);
    }
  }, [apiFetch, identity]);

  useFocusEffect(
    useCallback(() => {
      if (status !== 'loading') {
        void loadPlans();
      }
      return () => { plansGeneration.current++; };
    }, [status, loadPlans]),
  );

  const loadSchedules = useCallback(async () => {
    if (selectedPlanId === null || status === 'loading' || savingRef.current) return;
    const generation = ++monthGeneration.current;
    const live = () => mounted.current && liveContext.current === context
      && generation === monthGeneration.current;
    setSchedulesError(false);
    try {
      const res = await apiFetch(
        `/api/v1/todos/schedules/month/?plan_id=${selectedPlanId}&month=${cursor.month}&year=${cursor.year}`,
      );
      if (!res.ok) throw new Error(`schedules ${res.status}`);
      const list = normalizeMonthSchedules(await res.json());
      if (!live()) return;
      loadedContext.current = context;
      setSchedules(list);
      const pending = pendingDate.current;
      if (pending && !list.some(s => s.date === pending.date)) {
        pendingDate.current = null;
        Alert.alert('일정 안내', '해당 날짜에 등록된 일정이 없어요.');
      }
    } catch (error) {
      if (!live()) return;
      console.error('[Schedule] month load failed:', error);
      setSchedulesError(true);
    }
  }, [apiFetch, context, status]);

  useFocusEffect(useCallback(() => {
    void loadSchedules();
    return () => {
      monthGeneration.current++;
      navigationGeneration.current++;
    };
  }, [loadSchedules]));

  useFocusEffect(useCallback(() => () => {
    pendingDate.current = null;
  }, []));

  // 웹처럼 연간 일정을 백그라운드 프리페치해 월 칩의 진행 점을 채운다.
  useEffect(() => {
    if (selectedPlanId === null || status === 'loading') return;
    let cancelled = false;
    const planId = selectedPlanId;
    const year = cursor.year;
    const prefetch = async () => {
      for (const month of MONTHS) {
        if (cancelled) return;
        if (month === cursor.month) continue;
        try {
          const res = await apiFetch(
            `/api/v1/todos/schedules/month/?plan_id=${planId}&month=${month}&year=${year}`,
          );
          if (!res.ok || cancelled) continue;
          const list = normalizeMonthSchedules(await res.json());
          if (cancelled || !mounted.current || liveContext.current.identity !== identity) return;
          // A foreground load (or optimistic write) owns the visible month's dot.
          if (liveContext.current.plan === planId && liveContext.current.year === year
            && liveContext.current.month === month) continue;
          const byDate = groupByDate(list);
          const summary = monthSummary(byDate);
          setMonthProgress((prev) => ({
            ...prev,
            [`${planId}:${year}:${month}`]: { done: summary.completedDays, total: summary.totalDays },
          }));
        } catch {
          // 프리페치 실패는 조용히 무시 — 점만 안 찍힌다.
        }
      }
    };
    void prefetch();
    return () => {
      cancelled = true;
    };
  }, [selectedPlanId, cursor.year, identity]);

  const byDate = useMemo(() => groupByDate(schedules ?? []), [schedules]);
  const dayGroups = useMemo<DayGroup[]>(() => {
    const sorted = sortSchedules(schedules ?? []);
    const order: string[] = [];
    const map = new Map<string, ScheduleEntry[]>();
    for (const s of sorted) {
      if (!map.has(s.date)) {
        map.set(s.date, []);
        order.push(s.date);
      }
      map.get(s.date)!.push(s);
    }
    return order.map((date) => ({ date, schedules: map.get(date)! }));
  }, [schedules]);

  const summary = useMemo(() => monthSummary(byDate), [byDate]);

  // 현재 월의 진행 점도 갱신한다.
  useEffect(() => {
    if (schedules === null || loadedContext.current !== context) return;
    setMonthProgress((prev) => ({
      ...prev,
      [progressKey(cursor.month)]: { done: summary.completedDays, total: summary.totalDays },
    }));
  }, [schedules, context, summary]);

  const selectedPlan = subscriptions?.find((s) => s.plan_id === selectedPlanId) ?? null;
  const defaultPlanName = subscriptions?.find((s) => s.is_default)?.plan_name
    ?? subscriptions?.[0]?.plan_name
    ?? '2026 성경통독';

  const scrollToDate = (date: string) => {
    const y = cardOffsets.current[date];
    if (y !== undefined) {
      listRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: false });
      pendingDate.current = null;
    }
  };

  const jumpToDate = (date: string) => {
    pendingDate.current = { identity, plan: selectedPlanId, date };
    const [year, month] = date.split('-').map(Number);
    if (year !== cursor.year || month !== cursor.month) {
      setCursor({ year, month });
      return;
    }
    if (loadedContext.current === context) {
      if (schedules?.some(s => s.date === date)) scrollToDate(date);
      else {
        pendingDate.current = null;
        Alert.alert('일정 안내', '해당 날짜에 등록된 일정이 없어요.');
      }
    }
  };

  const scrollToToday = () => {
    if (savingRef.current || selectedPlanId === null) return;
    navigationGeneration.current++;
    jumpToDate(todayKey());
  };

  const scrollToLastIncomplete = async () => {
    if (selectedPlanId === null || savingRef.current) return;
    const generation = ++navigationGeneration.current;
    const live = () => mounted.current && liveContext.current === context
      && generation === navigationGeneration.current;
    try {
      const res = await apiFetch(`/api/v1/todos/next-position/?plan_id=${selectedPlanId}`);
      if (!res.ok) throw new Error(`next-position ${res.status}`);
      const pos = normalizeNextPosition(await res.json());
      if (!live()) return;
      if (!pos?.date || pos.status === 'no_schedule') {
        Alert.alert('일정 안내', pos?.message ?? (pos?.status === 'all_completed'
          ? '모든 일정을 완료했어요.' : '이동할 일정이 없어요.'));
        return;
      }
      if (pos.status === 'all_completed') Alert.alert('일정 안내', pos.message ?? '모든 일정을 완료했어요.');
      jumpToDate(pos.date);
    } catch {
      if (live()) Alert.alert('오류', '이동할 일정을 불러오지 못했어요. 다시 시도해 주세요.');
    }
  };

  const applyUpdate = async (ids: number[], complete: boolean) => {
    if (selectedPlanId === null || ids.length === 0 || savingRef.current) return false;
    const live = () => mounted.current && liveContext.current === context;
    const previous = schedules;
    savingRef.current = true;
    monthGeneration.current++;
    setSaving(true);
    setSchedules(
      (schedules ?? []).map((s) => (ids.includes(s.id) ? { ...s, is_completed: complete } : s)),
    );
    try {
      const res = await apiFetch('/api/v1/todos/reading/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          schedule_ids: ids,
          action: complete ? 'complete' : 'cancel',
        }),
      });
      if (!res.ok) throw new Error(`update ${res.status}`);
      const result: unknown = await res.json();
      if (typeof result !== 'object' || result === null
        || !('success' in result) || result.success !== true) {
        throw new Error('update rejected');
      }
      return live();
    } catch (error) {
      if (!live()) return false;
      console.error('[Schedule] progress update failed:', error);
      setSchedules(previous);
      Alert.alert('오류', '읽기 상태를 저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      if (live()) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const toggleSchedule = (schedule: ScheduleEntry) => {
    if (bulkMode) {
      handleCardPress({ date: schedule.date, schedules: [schedule] });
      return;
    }
    if (status !== 'signedIn') {
      openLogin();
      return;
    }
    void applyUpdate([schedule.id], !schedule.is_completed);
  };

  const handleCardPress = (group: DayGroup) => {
    if (savingRef.current) return;
    if (bulkMode) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(group.date);
        setRangeEnd(null);
      } else {
        const [a, b] = group.date < rangeStart ? [group.date, rangeStart] : [rangeStart, group.date];
        setRangeStart(a);
        setRangeEnd(b);
      }
      return;
    }
    const first = group.schedules[0];
    if (first && selectedPlanId !== null) {
      const url = scheduleReaderUrl(first, selectedPlanId);
      if (!url) return;
      Alert.alert('본문 페이지로 이동할까요?',
        `${formatScheduleDate(first.date)} · ${scheduleTitle(first)}`, [
          { text: '취소', style: 'cancel' },
          { text: '이동', onPress: () => {
            if (mounted.current && liveContext.current === context) openBibleChapter(url);
          } },
        ]);
    }
  };

  const inRange = (date: string) =>
    rangeStart !== null && rangeEnd !== null && date >= rangeStart && date <= rangeEnd;

  const rangeIds = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return (schedules ?? [])
      .filter((s) => s.date >= rangeStart && s.date <= rangeEnd)
      .map((s) => s.id);
  }, [schedules, rangeStart, rangeEnd]);

  const applyRange = async (complete: boolean) => {
    if (await applyUpdate(rangeIds, complete)) {
      setBulkMode(false);
      setRangeStart(null);
      setRangeEnd(null);
    }
  };

  const exitBulk = () => {
    setBulkMode(false);
    setRangeStart(null);
    setRangeEnd(null);
  };

  // --- 렌더 ---------------------------------------------------------------

  const headerRight = status === 'signedIn' ? (
    <TouchableOpacity
      style={[styles.headerPill, bulkMode && styles.headerPillActive]}
      onPress={() => (bulkMode ? exitBulk() : setBulkMode(true))}
      disabled={saving}
    >
      <Text style={[styles.headerPillText, bulkMode && styles.headerPillTextActive]}>
        {bulkMode ? '완료' : '일괄수정'}
      </Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity style={styles.headerPill} onPress={openLogin}>
      <Text style={styles.headerPillText}>로그인</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더: ‹ 성경통독표 + 우측 pill */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => {
            if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Home' });
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>성경통독표</Text>
        {headerRight}
      </View>

      {/* 고정 컨트롤: 플랜 칩 + 빠른 이동 + 월 칩 + 게스트 안내 */}
      <View style={styles.fixedControls}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.planChip}
            onPress={() => setShowPlanModal(true)}
            disabled={saving}
          >
            <Text style={styles.planChipText} numberOfLines={1}>
              {selectedPlan?.plan_name ?? defaultPlanName}
            </Text>
            <Ionicons name="chevron-down" size={16} color={TEXT} />
          </TouchableOpacity>
          <View style={styles.quickNav}>
            <TouchableOpacity style={styles.quickButton} onPress={scrollToToday} disabled={saving}>
              <Ionicons name="calendar-outline" size={13} color={ACCENT} />
              <Text style={styles.quickButtonText}>오늘</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => void scrollToLastIncomplete()}
              disabled={saving}
            >
              <Ionicons name="list-outline" size={13} color={ACCENT} />
              <Text style={styles.quickButtonText}>마지막 미완료</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthRow}
        >
          {MONTHS.map((month) => {
            const active = month === cursor.month;
            const progress = monthProgress[progressKey(month)];
            const dotColor = !progress
              ? BORDER
              : progress.total > 0 && progress.done === progress.total
                ? ACCENT
                : progress.done > 0
                  ? PARTIAL
                  : BORDER;
            return (
              <TouchableOpacity
                key={month}
                style={[styles.monthChip, active && styles.monthChipActive]}
                onPress={() => {
                  navigationGeneration.current++;
                  pendingDate.current = null;
                  setCursor((c) => ({ year: c.year, month }));
                }}
                disabled={saving}
              >
                <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
                  {month}월
                </Text>
                {progress !== undefined && (
                  <View
                    style={[
                      styles.monthDot,
                      { backgroundColor: active ? 'rgba(255,255,255,0.6)' : dotColor },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {status === 'signedOut' && (
          <View style={styles.guestNotice}>
            <Text style={styles.guestNoticeText}>
              비로그인 상태에서는 <Text style={styles.guestNoticeStrong}>{defaultPlanName}</Text>
              이 기본으로 표시돼요. 읽음 표시는 로그인 후 기록됩니다.
            </Text>
          </View>
        )}
      </View>

      {/* 본문 */}
      {plansError ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>플랜을 불러오지 못했습니다.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadPlans()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : subscriptions === null || (selectedPlanId !== null && schedules === null && !schedulesError) ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : schedulesError ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>일정을 불러오지 못했습니다.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadSchedules()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : selectedPlanId === null ? (
        <View style={styles.centerBox}>
          <Ionicons name="calendar-outline" size={28} color={TERTIARY} />
          <Text style={styles.emptyText}>플랜을 선택해주세요</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setShowPlanModal(true)}>
            <Text style={styles.retryButtonText}>플랜 선택</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={listRef}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarInset }]}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const visible = event.nativeEvent.contentOffset.y > 300;
            if (visible !== topVisible.current) {
              topVisible.current = visible;
              setShowTop(visible);
            }
          }}
        >
          {/* 월 요약 */}
          <View style={styles.monthSummary}>
            <View style={styles.monthSummaryRow}>
              <Text style={styles.monthSummaryTitle}>
                {cursor.year}년 {cursor.month}월
              </Text>
              <Text style={styles.monthSummaryStat}>
                {summary.completedDays}/{summary.totalDays}일 완료 · {summary.percent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${summary.percent}%` },
                ]}
              />
            </View>
          </View>

          {dayGroups.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{cursor.month}월에 등록된 일정이 없습니다.</Text>
            </View>
          ) : (
            dayGroups.map((group) => {
              const allDone = group.schedules.every((s) => s.is_completed);
              const mixed = !allDone && group.schedules.some((s) => s.is_completed);
              const statusOf = readingStatus(group.date, allDone, todayKey());
              const selected = inRange(group.date);
              const isRangeEdge = group.date === rangeStart;
              return (
                <View
                  key={group.date}
                  style={[
                    styles.card,
                    statusOf === 'current' && styles.cardCurrent,
                    (selected || isRangeEdge) && styles.cardSelected,
                  ]}
                  onLayout={(e) => {
                    if (liveContext.current !== context || loadedContext.current !== context) return;
                    cardOffsets.current[group.date] = e.nativeEvent.layout.y;
                    if (pendingDate.current?.date === group.date) scrollToDate(group.date);
                  }}
                >
                  <View style={styles.cardRow}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${formatScheduleDate(group.date)} ${bulkMode ? '범위 선택' : '읽음 표시'}`}
                      accessibilityState={{ checked: mixed ? 'mixed' : allDone, disabled: saving }}
                      onPress={() => {
                        if (bulkMode) {
                          handleCardPress(group);
                          return;
                        }
                        if (status !== 'signedIn') {
                          openLogin();
                          return;
                        }
                        void applyUpdate(
                          group.schedules.map((s) => s.id),
                          !allDone,
                        );
                      }}
                      hitSlop={6}
                      disabled={saving}
                    >
                      <View
                        style={[
                          styles.checkCircle,
                          allDone && styles.checkCircleDone,
                          statusOf === 'not_completed' && !allDone && styles.checkCircleMissed,
                        ]}
                      >
                        {allDone ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : mixed ? (
                          <Ionicons name="remove" size={16} color={ACCENT} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.cardInfo}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`${formatScheduleDate(group.date)} ${bulkMode ? '범위 선택' : '본문 읽기'}`}
                        accessibilityState={{ selected: selected || isRangeEdge, disabled: saving }}
                        onPress={() => handleCardPress(group)}
                        disabled={saving}
                        hitSlop={6}
                      >
                        <Text
                          style={[
                            styles.cardDate,
                            statusOf === 'current' && styles.cardDateCurrent,
                          ]}
                        >
                          {formatScheduleDate(group.date)}
                        </Text>
                      </TouchableOpacity>
                      {group.schedules.map((s) => (
                        <View key={s.id} style={styles.cardReadingRow}>
                          {group.schedules.length > 1 && (
                            <TouchableOpacity
                              onPress={() => toggleSchedule(s)}
                              accessibilityRole="checkbox"
                              accessibilityLabel={`${scheduleTitle(s)} ${bulkMode ? '범위 선택' : '읽음 표시'}`}
                              accessibilityState={{ checked: s.is_completed, disabled: saving }}
                              hitSlop={6}
                              disabled={saving}
                            >
                              <View
                                style={[
                                  styles.checkCircleSmall,
                                  s.is_completed && styles.checkCircleDone,
                                ]}
                              >
                                {s.is_completed && (
                                  <Ionicons name="checkmark" size={12} color="#fff" />
                                )}
                              </View>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`${scheduleTitle(s)} ${bulkMode ? '범위 선택' : '본문 읽기'}`}
                            accessibilityState={{ disabled: saving }}
                            style={{ flex: 1, minHeight: 32, justifyContent: 'center' }}
                            hitSlop={6}
                            disabled={saving}
                            onPress={() => handleCardPress({ date: s.date, schedules: [s] })}
                          >
                            <Text style={styles.cardTitle}>{scheduleTitle(s)}</Text>
                          </TouchableOpacity>
                          {group.schedules.length > 1 && (
                            <StatusBadgeView status={readingStatus(group.date, s.is_completed, todayKey())} />
                          )}
                        </View>
                      ))}
                    </View>
                    {group.schedules.length === 1 && <StatusBadgeView status={statusOf} />}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {showTop && (
        <View style={[styles.topButton, { bottom: tabBarInset + (bulkMode ? 80 : 16) }]}>
          <NativeButton
            label="맨 위로"
            onPress={() => listRef.current?.scrollTo({ y: 0, animated: false })}
          />
        </View>
      )}

      {/* 일괄수정 액션 바 */}
      {bulkMode && (
        <View style={[styles.bulkBar, { paddingBottom: 10 + tabBarInset }]}>
          <Text style={styles.bulkBarText}>
            {rangeStart && rangeEnd
              ? `${formatScheduleDate(rangeStart)} ~ ${formatScheduleDate(rangeEnd)} · ${rangeIds.length}개`
              : '날짜를 두 번 탭해 범위를 선택하세요'}
          </Text>
          <View style={styles.bulkBarActions}>
            <TouchableOpacity
              style={[styles.bulkButton, (!rangeStart || !rangeEnd) && styles.bulkButtonDisabled]}
              disabled={!rangeStart || !rangeEnd || saving}
              onPress={() => void applyRange(true)}
            >
              <Text style={styles.bulkButtonText}>읽음</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, (!rangeStart || !rangeEnd) && styles.bulkButtonDisabled]}
              disabled={!rangeStart || !rangeEnd || saving}
              onPress={() => void applyRange(false)}
            >
              <Text style={styles.bulkButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 플랜 선택 모달 */}
      <Modal
        visible={showPlanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanModal(false)}
      >
        <TouchableOpacity
          style={styles.modalScrim}
          activeOpacity={1}
          onPress={() => setShowPlanModal(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>플랜 선택</Text>
            {(subscriptions ?? []).map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.modalRow,
                  sub.plan_id === selectedPlanId && styles.modalRowActive,
                ]}
                onPress={() => {
                  if (savingRef.current) return;
                  navigationGeneration.current++;
                  pendingDate.current = null;
                  setSelectedPlanId(sub.plan_id);
                  setShowPlanModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalRowText,
                    sub.plan_id === selectedPlanId && styles.modalRowTextActive,
                  ]}
                >
                  {sub.plan_name}
                </Text>
                {sub.plan_id === selectedPlanId && (
                  <Ionicons name="checkmark" size={18} color={ACCENT} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalManage}
              onPress={() => {
                setShowPlanModal(false);
                openWebPath(stack.web, '/plans');
              }}
            >
              <Text style={styles.modalManageText}>플랜 관리</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function StatusBadgeView({ status }: { readonly status: ReadingStatus }) {
  return (
    <View
      style={[
        styles.badge,
        status === 'completed' && styles.badgeCompleted,
        status === 'current' && styles.badgeCurrent,
        status === 'not_completed' && styles.badgeMissed,
        status === 'upcoming' && styles.badgeUpcoming,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          status === 'completed' && { color: ACCENT },
          status === 'current' && { color: '#fff' },
          status === 'not_completed' && { color: ERROR },
          status === 'upcoming' && { color: TERTIARY },
        ]}
      >
        {STATUS_TEXT[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topButton: { position: 'absolute', right: 20 },
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.4,
  },
  headerPill: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerPillActive: {
    backgroundColor: ACCENT,
  },
  headerPillText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  headerPillTextActive: {
    color: '#fff',
  },
  fixedControls: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: CARD,
  },
  planChipText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  quickNav: {
    flexDirection: 'row',
    gap: 4,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
  },
  quickButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  monthRow: {
    gap: 8,
    paddingVertical: 4,
  },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: CARD,
  },
  monthChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  monthChipText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  monthChipTextActive: {
    color: '#fff',
  },
  monthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  guestNotice: {
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: CARD,
  },
  guestNoticeText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  guestNoticeStrong: {
    fontFamily: 'Pretendard-SemiBold',
    color: TEXT,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  monthSummary: {
    marginBottom: 14,
  },
  monthSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthSummaryTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
  monthSummaryStat: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  cardCurrent: {
    borderColor: ACCENT,
  },
  cardSelected: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  checkCircleDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkCircleMissed: {
    borderColor: ERROR,
    borderStyle: 'dashed',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardDate: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: TERTIARY,
    letterSpacing: -0.4,
  },
  cardDateCurrent: {
    color: ACCENT,
  },
  cardReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeCompleted: { backgroundColor: ACCENT_BG },
  badgeCurrent: { backgroundColor: ACCENT },
  badgeMissed: { backgroundColor: ERROR_BG },
  badgeUpcoming: { borderColor: BORDER },
  badgeText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 11,
    letterSpacing: -0.4,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  emptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: SECONDARY,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  retryButton: {
    backgroundColor: ACCENT_BG,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: CARD,
    gap: 8,
  },
  bulkBarText: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  bulkBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    backgroundColor: ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  bulkButtonDisabled: {
    opacity: 0.4,
  },
  bulkButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: '#fff',
    letterSpacing: -0.4,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 32,
  },
  modalSheet: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: TEXT,
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalRowActive: {
    backgroundColor: ACCENT_BG,
  },
  modalRowText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
  modalRowTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    color: ACCENT,
  },
  modalManage: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  modalManageText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
});
