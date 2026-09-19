import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef } from '../navigation/navigationRef';
import { rangeLabel } from '../api/bibleBooks';
import {
  buildMonthGrid,
  groupByDate,
  normalizeMonthSchedules,
  pickDefaultPlan,
  shiftMonth,
  type PlanSubscription,
  type ScheduleEntry,
  type UserPlansResponse,
} from '../api/scheduleData';

const ACCENT = '#4B9F7E';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const openWebPath = (webBase: string, path: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('WebView', { url: `${webBase}${path}` });
  }
};

const openLogin = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Login');
  }
};

const todayParts = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function ScheduleScreen() {
  const { status, apiFetch } = useAuth();
  const { stack } = useAppStack();

  const [subscriptions, setSubscriptions] = useState<PlanSubscription[] | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(todayParts);
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [schedulesError, setSchedulesError] = useState(false);

  const loadPlans = useCallback(async () => {
    setPlansError(false);
    try {
      const res = await apiFetch('/api/v1/todos/plans/user/');
      if (!res.ok) throw new Error(`plans ${res.status}`);
      const json = (await res.json()) as Partial<UserPlansResponse>;
      const subs = Array.isArray(json.subscriptions) ? json.subscriptions : [];
      setSubscriptions(subs);
      setSelectedPlanId((current) => {
        if (current !== null && subs.some((s) => s.plan_id === current && s.is_active)) {
          return current;
        }
        return pickDefaultPlan(subs)?.plan_id ?? null;
      });
    } catch (error) {
      console.error('[Schedule] plans load failed:', error);
      setPlansError(true);
    }
  }, [apiFetch]);

  // Plans can change inside the WebView (플랜 찾기 → 구독), so refresh on focus.
  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') {
        void loadPlans();
      }
    }, [status, loadPlans]),
  );

  const loadSchedules = useCallback(async () => {
    if (selectedPlanId === null) return;
    setSchedulesError(false);
    try {
      const res = await apiFetch(
        `/api/v1/todos/schedules/month/?plan_id=${selectedPlanId}&month=${cursor.month}&year=${cursor.year}`,
      );
      if (!res.ok) throw new Error(`schedules ${res.status}`);
      setSchedules(normalizeMonthSchedules(await res.json()));
    } catch (error) {
      console.error('[Schedule] month load failed:', error);
      setSchedulesError(true);
    }
  }, [apiFetch, selectedPlanId, cursor]);

  useEffect(() => {
    if (status !== 'signedIn' || selectedPlanId === null) return;
    setSchedules(null);
    void loadSchedules();
  }, [status, selectedPlanId, cursor, loadSchedules]);

  const byDate = useMemo(() => groupByDate(schedules ?? []), [schedules]);
  const weeks = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, byDate),
    [cursor, byDate],
  );
  const daySchedules = selectedDate ? byDate[selectedDate] ?? [] : [];

  const moveMonth = (delta: number) => {
    setCursor((c) => shiftMonth(c.year, c.month, delta));
    setSelectedDate(null);
  };

  const toggleSchedule = async (schedule: ScheduleEntry) => {
    if (selectedPlanId === null) return;
    const next = !schedule.is_completed;
    const previous = schedules;
    setSchedules(
      (schedules ?? []).map((s) =>
        s.id === schedule.id ? { ...s, is_completed: next } : s,
      ),
    );
    try {
      const res = await apiFetch('/api/v1/todos/reading/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          schedule_ids: [schedule.id],
          // Backend accepts 'complete' | 'cancel' — not 'incomplete'.
          action: next ? 'complete' : 'cancel',
        }),
      });
      if (!res.ok) throw new Error(`update ${res.status}`);
    } catch (error) {
      console.error('[Schedule] progress update failed:', error);
      setSchedules(previous);
      Alert.alert('오류', '읽기 상태를 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  // --- 상태별 화면 ---------------------------------------------------------

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'signedOut') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>통독표</Text>
          <Text style={styles.emptyMessage}>
            로그인하면 내 통독 플랜과 읽기 진도를 확인할 수 있어요.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={openLogin}>
            <Text style={styles.primaryButtonText}>로그인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (plansError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyMessage}>플랜을 불러오지 못했습니다.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void loadPlans()}>
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (subscriptions === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const activeSubscriptions = subscriptions.filter((s) => s.is_active);

  if (activeSubscriptions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>통독표</Text>
          <Text style={styles.emptyMessage}>
            구독 중인 통독 플랜이 없어요.{'\n'}플랜을 찾아 시작해 보세요.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openWebPath(stack.web, '/plans')}
          >
            <Text style={styles.primaryButtonText}>플랜 찾기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>통독표</Text>

        {/* 플랜 선택 칩 + 플랜 찾기 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {activeSubscriptions.map((sub) => {
            const selected = sub.plan_id === selectedPlanId;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  setSelectedPlanId(sub.plan_id);
                  setSelectedDate(null);
                }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {sub.plan_name}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.chipGhost}
            onPress={() => openWebPath(stack.web, '/plans')}
          >
            <Text style={styles.chipGhostText}>플랜 찾기</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 월 이동 */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => moveMonth(-1)} style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {cursor.year}년 {cursor.month}월
          </Text>
          <TouchableOpacity onPress={() => moveMonth(1)} style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {schedulesError ? (
          <View style={styles.centerPadded}>
            <Text style={styles.emptyMessage}>일정을 불러오지 못했습니다.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void loadSchedules()}
            >
              <Text style={styles.primaryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : schedules === null ? (
          <View style={styles.centerPadded}>
            <ActivityIndicator color={ACCENT} size="large" />
          </View>
        ) : (
          <>
            {/* 요일 헤더 + 달력 그리드 */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>
            {weeks.map((week, i) => (
              <View key={i} style={styles.weekRow}>
                {week.map((cell) => {
                  const allDone = cell.total > 0 && cell.completed === cell.total;
                  const partial = cell.completed > 0 && !allDone;
                  const selected = cell.date === selectedDate;
                  return (
                    <TouchableOpacity
                      key={cell.date}
                      style={[
                        styles.cell,
                        allDone && styles.cellDone,
                        partial && styles.cellPartial,
                        selected && styles.cellSelected,
                      ]}
                      onPress={() => setSelectedDate(cell.date)}
                      disabled={cell.total === 0}
                    >
                      <Text
                        style={[
                          styles.cellDay,
                          !cell.inCurrentMonth && styles.cellDayOutside,
                          allDone && styles.cellDayDone,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {cell.total > 0 && (
                        <Text
                          style={[styles.cellCount, allDone && styles.cellDayDone]}
                        >
                          {cell.completed}/{cell.total}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* 선택한 날짜의 일정 */}
            {selectedDate !== null && (
              <View style={styles.dayDetail}>
                <Text style={styles.dayDetailTitle}>
                  {Number(selectedDate.slice(5, 7))}월 {Number(selectedDate.slice(8, 10))}일
                </Text>
                {daySchedules.length === 0 ? (
                  <Text style={styles.emptyMessage}>이 날의 일정이 없습니다.</Text>
                ) : (
                  daySchedules.map((schedule) => (
                    <View key={schedule.id} style={styles.scheduleRow}>
                      <TouchableOpacity
                        style={styles.scheduleMain}
                        onPress={() => void toggleSchedule(schedule)}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            schedule.is_completed && styles.checkboxDone,
                          ]}
                        >
                          {schedule.is_completed && (
                            <Text style={styles.checkboxMark}>✓</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.scheduleLabel,
                            schedule.is_completed && styles.scheduleLabelDone,
                          ]}
                        >
                          {rangeLabel(
                            schedule.book,
                            schedule.start_chapter,
                            schedule.end_chapter,
                          )}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.readButton}
                        onPress={() =>
                          openWebPath(
                            stack.web,
                            `/bible?book=${schedule.book}&chapter=${schedule.start_chapter}`,
                          )
                        }
                      >
                        <Text style={styles.readButtonText}>읽기</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerPadded: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  screenTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#475569',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipGhost: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'dashed',
  },
  chipGhostText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: ACCENT,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  monthArrow: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  monthArrowText: {
    fontSize: 24,
    color: '#64748b',
    fontFamily: 'Pretendard-Regular',
  },
  monthTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: '#1e293b',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
  },
  cellDone: {
    backgroundColor: ACCENT,
  },
  cellPartial: {
    backgroundColor: 'rgba(75, 159, 126, 0.22)',
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  cellDay: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#334155',
  },
  cellDayOutside: {
    color: '#cbd5e1',
  },
  cellDayDone: {
    color: '#fff',
  },
  cellCount: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  dayDetail: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayDetailTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  scheduleMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  scheduleLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#1e293b',
  },
  scheduleLabelDone: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  readButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#eef7f2',
  },
  readButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: ACCENT,
  },
  emptyTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: '#333',
    marginBottom: 8,
  },
  emptyMessage: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-Medium',
    color: '#fff',
    fontSize: 14,
  },
});
