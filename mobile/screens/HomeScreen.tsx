import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { bookName, chapterUnit } from '../api/bibleBooks';
import {
  normalizeSchedule,
  parseHomeStats,
  pickEffectivePlanId,
  summarizeToday,
  type HomeStats,
  type TodaySchedule,
  type TodaySummary,
} from '../api/homeData';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const formatToday = (): string => {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`;
};

interface PlansPayload {
  readonly subscriptions?: unknown;
}

interface TodayPayload {
  readonly schedules?: unknown;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      planName: string | null;
      schedules: readonly TodaySchedule[];
      summary: TodaySummary;
      stats: HomeStats;
    };

export default function HomeScreen() {
  const { status, apiFetch } = useAuth();
  const { stack } = useAppStack();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const plansRes = await apiFetch('/api/v1/todos/plans/user/');
      if (!plansRes.ok) throw new Error(`plans ${plansRes.status}`);
      const plansJson = (await plansRes.json()) as PlansPayload | null;
      const planId = pickEffectivePlanId(plansJson?.subscriptions);

      const statsPromise = apiFetch('/api/v1/todos/bible/home-stats/')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => parseHomeStats(json));

      let planName: string | null = null;
      let schedules: TodaySchedule[] = [];
      if (planId !== null) {
        const todayRes = await apiFetch(
          `/api/v1/todos/schedules/today/?plan_id=${planId}`,
        );
        if (!todayRes.ok) throw new Error(`today ${todayRes.status}`);
        const todayJson = (await todayRes.json()) as TodayPayload | null;
        const rows = Array.isArray(todayJson?.schedules) ? todayJson.schedules : [];
        schedules = rows
          .map(normalizeSchedule)
          .filter((s): s is TodaySchedule => s !== null);
        planName = schedules[0]?.plan_name ?? null;
        if (!planName) {
          const subs = Array.isArray(plansJson?.subscriptions)
            ? plansJson.subscriptions
            : [];
          const match = subs.find(
            (s: unknown): s is { plan_id: number; plan_name?: unknown } =>
              typeof s === 'object'
              && s !== null
              && (s as { plan_id?: unknown }).plan_id === planId,
          );
          planName = typeof match?.plan_name === 'string' ? match.plan_name : null;
        }
      }

      const stats = await statsPromise;
      setState({
        kind: 'ready',
        planName,
        schedules,
        summary: summarizeToday(schedules),
        stats,
      });
    } catch (error) {
      console.error('[HomeScreen] load failed:', error);
      setState({ kind: 'error' });
    }
  }, [apiFetch]);

  // Refresh whenever the tab regains focus — returning from the WebView after
  // reading should reflect updated completion state.
  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') {
        void load();
      }
    }, [status, load]),
  );

  const openSchedule = (schedule: TodaySchedule) => {
    if (!navigationRef.isReady()) return;
    const url = `${stack.web}/bible?book=${schedule.book_code}&chapter=${schedule.start_chapter}`;
    navigationRef.navigate('WebView', { url });
  };

  const openLogin = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Login');
    }
  };

  const renderBody = () => {
    // signedOut must win over the initial 'loading' state — load() only runs
    // when signedIn, so a guest would otherwise spin forever.
    if (status === 'signedOut') {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>로그인이 필요합니다</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>로그인</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'loading' || state.kind === 'loading') {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4B9F7E" />
        </View>
      );
    }

    if (state.kind === 'error') {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>
            데이터를 불러오지 못했습니다
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void load()}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const { planName, schedules, summary, stats } = state;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>오늘의 통독</Text>
            {summary.total > 0 && (
              <Text style={styles.progressText}>
                {summary.completed}/{summary.total} 완료
              </Text>
            )}
          </View>
          {planName && <Text style={styles.planName}>{planName}</Text>}
          {summary.allComplete && (
            <Text style={styles.allDoneText}>오늘의 통독을 모두 완료했어요</Text>
          )}
          {schedules.length === 0 ? (
            <Text style={styles.emptyCardText}>
              오늘의 통독 일정이 없습니다
            </Text>
          ) : (
            schedules.map((schedule) => (
              <TouchableOpacity
                key={schedule.id}
                style={styles.scheduleRow}
                onPress={() => openSchedule(schedule)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.scheduleCheck,
                    schedule.is_completed && styles.scheduleCheckDone,
                  ]}
                >
                  {schedule.is_completed ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.scheduleLabel,
                    schedule.is_completed && styles.scheduleLabelDone,
                  ]}
                >
                  {`${bookName(schedule.book_code)} ${schedule.start_chapter}${
                    schedule.end_chapter !== schedule.start_chapter
                      ? `-${schedule.end_chapter}`
                      : ''
                  }${chapterUnit(schedule.book_code)}`}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.bookmarks}</Text>
            <Text style={styles.statLabel}>북마크</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.notes}</Text>
            <Text style={styles.statLabel}>노트</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.highlights}</Text>
            <Text style={styles.statLabel}>하이라이트</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>최근 읽은 본문</Text>
          {stats.recentRecords.length === 0 ? (
            <Text style={styles.emptyCardText}>
              아직 읽은 본문이 없습니다
            </Text>
          ) : (
            stats.recentRecords.map((record, index) => (
              <View
                key={`${record.book}-${record.chapter}-${index}`}
                style={styles.recordRow}
              >
                <Text style={styles.recordLabel}>
                  {`${bookName(record.book)} ${record.chapter}${chapterUnit(record.book)}`}
                </Text>
                <Text style={styles.recordDate}>{record.read_date}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>매일일독</Text>
        <Text style={styles.headerDate}>{formatToday()}</Text>
      </View>
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: '#1e293b',
    letterSpacing: -1,
  },
  headerDate: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    letterSpacing: -0.7,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#64748b',
    letterSpacing: -0.7,
  },
  primaryButton: {
    backgroundColor: '#4B9F7E',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.7,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  progressText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#4B9F7E',
    letterSpacing: -0.6,
  },
  planName: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    letterSpacing: -0.6,
  },
  allDoneText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#4B9F7E',
    marginTop: 8,
    letterSpacing: -0.6,
  },
  emptyCardText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
    letterSpacing: -0.7,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  scheduleCheck: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: '#cbd5e1',
    width: 20,
  },
  scheduleCheckDone: {
    color: '#4B9F7E',
  },
  scheduleLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#1e293b',
    letterSpacing: -0.7,
  },
  scheduleLabelDone: {
    color: '#94a3b8',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#1e293b',
  },
  statLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    letterSpacing: -0.6,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  recordLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#1e293b',
    letterSpacing: -0.7,
  },
  recordDate: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#94a3b8',
  },
});
