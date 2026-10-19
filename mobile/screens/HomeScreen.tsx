import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { NativeButton } from '../components/ui/NativeButton';
import { NativeStateView } from '../components/ui/NativeStateView';
import type { ApiFetch } from '../api/nativeApi';
import {
  assignmentUrl,
  buildWeek,
  parseHomePlans,
  pickEffectivePlanId,
  readHomeResponse,
  recentCompleted,
  parseHomeHasena,
  parseFirstHomeGroup,
  parseHomeGroupProgress,
  type HomeHasena,
  parseCalendarEntries,
  parseFinalScheduleDate,
  parseHomeUser,
  parseProgress,
  parseStreak,
  parseUnreadNotifications,
  type CalendarEntry,
  type HomeUser,
} from '../api/homeData';

const BG = '#FAF8F5';
const CARD = '#FFFFFF';
const TEXT = '#1F1A17';
const SECONDARY = '#6B625B';
const TERTIARY = '#9B928A';
const BORDER = '#E9E4DE';
const ACCENT = '#2A1111';
const ACCENT_BG = '#F3EEEE';
const SERIF = 'NotoSerifKR-Bold';

const SERIF_STYLE = { fontFamily: SERIF };

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const dateCaption = () =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

const openWebPath = (webBase: string, path: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('WebView', { url: `${webBase}${path}` });
  }
};

const openLogin = () => {
  if (navigationRef.isReady()) navigationRef.navigate('Login');
};

const openTab = (name: 'Schedule' | 'Together' | 'Bible' | 'Profile') => {
  if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: name });
};

const openBibleChapter = (url: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', {
      screen: 'Bible',
      params: { url },
    });
  }
};

interface PlanCardData {
  readonly subscriptionId: number;
  readonly planId: number;
  readonly planName: string;
  readonly progress: number;
  readonly passage: string;
  readonly description: string;
  readonly remainingDays: number | null;
  readonly route: string | null;
}

interface DashboardData {
  readonly user: HomeUser;
  readonly streak: number | null;
  readonly calendar: CalendarEntry[];
  readonly planCards: PlanCardData[];
  readonly availablePlans: { id: number; name: string; is_default: boolean }[];
  readonly unread: number;
  readonly primaryPlanId: number | null;
}

export default function HomeScreen() {
  const { status, apiFetch, accessToken } = useAuth();
  const { stack } = useAppStack();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [resending, setResending] = useState(false);
  const [subscribeResult, setSubscribeResult] = useState<'success' | 'error' | null>(null);
  const [resendResult, setResendResult] = useState<'success' | 'error' | null>(null);
  const submitting = useMemo(() => ({ subscribe: false, resend: false, active: true }),
    [status, stack, accessToken, apiFetch]);
  const generation = useRef(0);
  const [retry, setRetry] = useState(0);
  const tabBarInset = useNativeTabBarInset();

  const signedIn = status === 'signedIn';

  // Focus cleanup invalidates requests from a previous account or stack.
  const load = useCallback(async (request: number) => {
    if (!signedIn) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userRes = await apiFetch('/api/v1/auth/user/');
      if (!userRes.ok) throw new Error(`user ${userRes.status}`);
      const user = parseHomeUser(await userRes.json());
      if (!user) throw new Error('user parse');

      const today = todayKey();
      const monday = new Date(`${today}T00:00:00Z`);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const months = [
        ...new Set(
          Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setUTCDate(d.getUTCDate() + i);
            return d.toISOString().slice(0, 7);
          }),
        ),
      ];

      const [plansRes, profileRes, notifRes, ...calResponses] = await Promise.all([
        apiFetch('/api/v1/todos/plans/user/'),
        apiFetch(`/api/v1/auth/profile/${user.id}/`),
        apiFetch('/api/v1/todos/notifications/'),
        ...months.map((m) =>
          apiFetch(
            `/api/v1/auth/profile/${user.id}/calendar/?year=${m.slice(0, 4)}&month=${Number(m.slice(5))}`,
          ),
        ),
      ]);

      const { subscriptions, availablePlans } = parseHomePlans(await readHomeResponse(plansRes));
      const streak = parseStreak(await readHomeResponse(profileRes));
      if (streak === null) throw new Error('Invalid streak');
      const calendarJsons = await Promise.all(
        calResponses.map(readHomeResponse),
      );
      const calendar = calendarJsons.flatMap((j) => parseCalendarEntries(j));
      const unread = parseUnreadNotifications(await readHomeResponse(notifRes));

      const activeSubs = subscriptions.filter(
        (s: { is_active?: boolean }) => s.is_active,
      );
      const primaryPlanId = pickEffectivePlanId(activeSubs);
      const cardSubs = activeSubs.slice(0, 3);
      // A default outside the first three still owns the stats.
      const primarySub = activeSubs.find(s => s.plan_id === primaryPlanId);
      const fetchedSubs = primarySub && !cardSubs.includes(primarySub) ? [...cardSubs, primarySub] : cardSubs;
      const cardResults = await Promise.all(
        fetchedSubs.map(async (sub) => {
          const [progRes, schedRes] = await Promise.all([
            apiFetch(`/api/v1/todos/stats/progress/?plan_id=${sub.plan_id}`),
            apiFetch(`/api/v1/todos/schedules/?plan_id=${sub.plan_id}`),
          ]);
          const progressJson = await readHomeResponse(progRes);
          if (!progressJson || typeof progressJson !== 'object' || !('user_progress' in progressJson)
            || typeof progressJson.user_progress !== 'number') throw new Error('Invalid progress');
          const progress = parseProgress(progressJson);
          const schedules = await readHomeResponse(schedRes);
          if (!Array.isArray(schedules)) throw new Error('Invalid schedules');
          const finalDate = parseFinalScheduleDate(schedules);
          const remaining = finalDate
            ? Math.max(
                0,
                Math.ceil(
                  (Date.parse(`${finalDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
                    86400000,
                ),
              )
            : null;
          const todayEntry = calendar.find(
            (e) => e.plan_id === sub.plan_id && e.date === today,
          );
          const unit = todayEntry?.book === '시편' ? '편' : '장';
          const passage = todayEntry
            ? `${todayEntry.book} ${todayEntry.start_chapter === todayEntry.end_chapter ? todayEntry.start_chapter : `${todayEntry.start_chapter}-${todayEntry.end_chapter}`}${unit}`
            : '';
          const chapters = todayEntry
            ? todayEntry.end_chapter - todayEntry.start_chapter + 1
            : 0;
          return {
            subscriptionId: sub.id,
            planId: sub.plan_id,
            planName: sub.plan_name ?? '',
            progress,
            passage,
            description: todayEntry
              ? `총 ${chapters}${unit} · 오늘의 통독`
              : '오늘 예정된 본문이 없어요',
            remainingDays: remaining,
            route: todayEntry ? assignmentUrl(todayEntry) : null,
          } satisfies PlanCardData;
        }),
      );

      if (generation.current !== request) return;
      setData({
        user,
        streak,
        calendar,
        planCards: cardResults,
        availablePlans,
        unread,
        primaryPlanId,
      });
    } catch (error) {
      if (generation.current === request) setError('읽기 기록을 불러오지 못했습니다.');
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [signedIn, apiFetch]);

  useFocusEffect(
    useCallback(() => {
      const request = ++generation.current;
      if (status !== 'loading') void load(request);
      return () => { generation.current++; };
    }, [status, load, retry, stack, accessToken]),
  );

  useEffect(() => {
    setData(null);
    setError(null);
    setBannerDismissed(false);
    setSubscribeResult(null);
    setResendResult(null);
    submitting.active = true;
    setSubscribing(false);
    setResending(false);
    return () => { submitting.active = false; };
  }, [submitting]);

  const today = todayKey();
  const primaryCard = data?.planCards.find(c => c.planId === data.primaryPlanId) ?? null;
  const planCalendar = useMemo(
    () => (data && primaryCard ? data.calendar.filter((e) => e.plan_id === primaryCard.planId) : []),
    [data, primaryCard],
  );
  const week = useMemo(() => buildWeek(today, planCalendar), [today, planCalendar]);
  const weeklyCompleted = week.filter((d) => d.state === 'read').length;
  const recentRecords = recentCompleted(planCalendar, today);

  const showEmailBanner =
    signedIn &&
    !bannerDismissed &&
    data?.user &&
    data.user.email &&
    data.user.hasUsablePassword &&
    !data.user.emailVerified;

  const resendVerification = async () => {
    if (submitting.resend || !submitting.active) return;
    submitting.resend = true;
    setResending(true);
    setResendResult(null);
    try {
      await readHomeResponse(await apiFetch('/api/v1/auth/resend-verification/', { method: 'POST' }));
      if (submitting.active) setResendResult('success');
    } catch (error) {
      if (submitting.active) setResendResult('error');
    } finally {
      if (submitting.active) {
        submitting.resend = false;
        setResending(false);
      }
    }
  };

  const subscribeToDefault = async () => {
    const plan = data?.availablePlans.find((p) => p.is_default) ?? data?.availablePlans[0];
    if (!plan || submitting.subscribe || !submitting.active) return;
    submitting.subscribe = true;
    setSubscribing(true);
    setSubscribeResult(null);
    try {
      const res = await apiFetch('/api/v1/todos/plan/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      await readHomeResponse(res);
      if (submitting.active) {
        setSubscribeResult('success');
        setRetry((r) => r + 1);
      }
    } catch (error) {
      if (submitting.active) setSubscribeResult('error');
    } finally {
      if (submitting.active) {
        submitting.subscribe = false;
        setSubscribing(false);
      }
    }
  };

  const displayName = data?.user
    ? data.user.nickname || data.user.username || '성도'
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 이메일 인증 배너 */}
      {showEmailBanner && (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={18} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText}>이메일 인증이 완료되지 않았습니다.</Text>
            <TouchableOpacity testID="home-resend" accessibilityRole="button"
              accessibilityLabel="인증 메일 재전송" accessibilityState={{ disabled: resending, busy: resending }}
              disabled={resending} onPress={resendVerification} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={styles.bannerLink}>{resending ? '보내는 중…' : '인증 메일 재전송'}</Text>
            </TouchableOpacity>
            {resendResult && <Text testID={`home-resend-${resendResult}`} accessibilityLiveRegion="polite"
              accessibilityRole={resendResult === 'error' ? 'alert' : 'text'} style={styles.bannerText}>
              {resendResult === 'success' ? '인증 메일을 보냈습니다.' : '메일을 보내지 못했습니다. 다시 시도해 주세요.'}
            </Text>}
          </View>
          <TouchableOpacity onPress={() => setBannerDismissed(true)} hitSlop={8}>
            <Ionicons name="close" size={18} color="#92400E" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset }]}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerActions}>
            {signedIn ? (
              <>
                <TouchableOpacity
                  style={styles.headerIcon}
                  onPress={() => openWebPath(stack.web, '/notifications')}
                  hitSlop={8}
                >
                  <Ionicons name="notifications-outline" size={24} color={TEXT} />
                  {(data?.unread ?? 0) > 0 && <View style={styles.badgeDot} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatar}
                  onPress={() => openTab('Profile')}
                >
                  <Text style={styles.avatarText}>
                    {(displayName ?? '?').slice(0, 1).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.headerIcon} hitSlop={8}>
                  <Ionicons name="moon-outline" size={22} color={TEXT} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIcon}
                  onPress={() => setMenuOpen(true)}
                  hitSlop={8}
                >
                  <Ionicons name="menu" size={24} color={TEXT} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* 히어로 */}
        <View style={styles.hero}>
          <Text style={styles.greeting}>
            {signedIn ? dateCaption() : '방문자님, 환영합니다'}
          </Text>
          <Text style={[styles.heroTitle, SERIF_STYLE]}>
            {signedIn
              ? `${displayName ?? '성도'}님${data?.streak ? `, ${data.streak}일째` : ''}\n이어가고 있어요`
              : '말씀과 함께\n시작해보세요'}
          </Text>
        </View>

        {/* 메인 카드 */}
        {status === 'loading' || (signedIn && loading) ? (
          <View testID="home-loading"><NativeStateView kind="loading" message="읽기 기록을 불러오는 중…" /></View>
        ) : signedIn && error ? (
          <View testID="home-error">
            <NativeStateView kind="error" message={error} />
            <TouchableOpacity testID="home-retry" accessibilityRole="button" style={styles.secondaryButton}
              onPress={() => setRetry(r => r + 1)}>
              <Text style={styles.secondaryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : signedIn ? (
          data?.planCards.length ? (
            data.planCards.slice(0, 3).map((card) => (
              <View key={card.subscriptionId} style={styles.card}>
                <View style={styles.cardRow}>
                  <ProgressRing progress={card.progress} />
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardLabel}>
                      {card.planName || '성경통독'} · 오늘 읽을 본문
                    </Text>
                    <Text style={[styles.cardPassage, SERIF_STYLE]}>
                      {card.passage || '통독표를 확인해보세요'}
                    </Text>
                    <Text style={styles.cardDesc}>{card.description}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  testID={`home-read-${card.planId}`}
                  accessibilityRole="button"
                  style={styles.primaryButton}
                  onPress={() => {
                    if (card.route) {
                      openBibleChapter(card.route);
                    } else {
                      openTab('Schedule');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>
                    {card.route ? '오늘 본문 읽기' : '통독표 보기'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View testID="home-empty" style={[styles.card, styles.planSuggestion]}>
              <Text style={styles.suggestionText}>아직 통독 플랜이 없어요</Text>
              {data?.availablePlans.length ? (
                <>
                  <Text style={styles.suggestionPlan}>
                    {(data.availablePlans.find((p) => p.is_default) ?? data.availablePlans[0]).name}
                  </Text>
                  <TouchableOpacity
                    testID="home-subscribe"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: subscribing, busy: subscribing }}
                    style={styles.secondaryButton}
                    onPress={subscribeToDefault}
                    disabled={subscribing}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {subscribing ? '시작하는 중…' : '이 플랜으로 시작하기'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => openTab('Schedule')}
                >
                  <Text style={styles.secondaryButtonText}>통독표 보기</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        ) : (
          <View style={styles.card}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.cardLabel}>WELCOME</Text>
              <Text style={[styles.cardPassage, SERIF_STYLE]}>
                {'로그인하고\n시작하세요'}
              </Text>
              <Text style={styles.cardDesc}>나만의 통독 기록을 관리할 수 있습니다</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>로그인 / 회원가입</Text>
            </TouchableOpacity>
          </View>
        )}
        {subscribeResult && <Text testID={`home-subscribe-${subscribeResult}`}
          accessibilityLiveRegion="polite" accessibilityRole={subscribeResult === 'error' ? 'alert' : 'text'}
          style={styles.cardDesc}>
          {subscribeResult === 'success' ? '통독 플랜을 시작했습니다.' : '플랜을 시작하지 못했습니다. 다시 시도해 주세요.'}
        </Text>}

        {/* 통계 + 이번 주 (로그인만) */}
        {signedIn && data && !loading && !error && (
          <>
            <View testID="home-stats" accessibilityValue={{ text: `${weeklyCompleted}/7` }} style={styles.statsRow}>
              <StatCard icon="flame-outline" label="연속" value={`${data.streak ?? '-'}`} unit="일" />
              <StatCard icon="calendar-outline" label="이번 주" value={`${weeklyCompleted}`} unit="/7" />
              <StatCard
                icon="book-outline"
                label="완독까지"
                value={primaryCard?.remainingDays != null ? `${primaryCard.remainingDays}` : '-'}
                unit="일"
              />
            </View>
            <View style={styles.weekCard}>
              <Text style={styles.weekTitle}>최근 기록</Text>
              {recentRecords.length ? recentRecords.map(record => (
                <TouchableOpacity key={record.schedule_id} testID={`home-recent-${record.schedule_id}`}
                  accessibilityRole="button" onPress={() => openTab('Schedule')}
                  style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark" size={16} color={ACCENT} />
                  <Text style={[styles.cardDesc, { flex: 1 }]}>
                    {record.book} {record.start_chapter === record.end_chapter ? record.start_chapter
                      : `${record.start_chapter}-${record.end_chapter}`}{record.book === '시편' ? '편' : '장'}
                  </Text>
                  <Text style={styles.cardDesc}>{record.date.slice(5).replace('-', '.')}</Text>
                </TouchableOpacity>
              )) : <Text style={styles.cardDesc}>최근 완료한 통독 기록이 없어요.</Text>}
            </View>
            <View style={styles.weekCard}>
              <Text style={styles.weekTitle}>이번 주</Text>
              <View style={styles.weekRow}>
                {week.map((day) => (
                  <View key={day.date} style={styles.weekDay}>
                    <Text style={[styles.weekdayLabel, day.isToday && { color: ACCENT }]}>
                      {day.label}
                    </Text>
                    <View
                      style={[
                        styles.weekDot,
                        day.state === 'read' && styles.weekDotRead,
                        day.state === 'today' && styles.weekDotToday,
                        (day.state === 'upcoming' || day.state === 'missed') &&
                          styles.weekDotEmpty,
                        day.state === 'upcoming' && { borderStyle: 'dashed' },
                      ]}
                    >
                      {day.state === 'read' ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : (
                        <Text
                          style={[
                            styles.weekDotText,
                            day.state === 'today' && { color: ACCENT },
                          ]}
                        >
                          {day.number}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <HomeAside apiFetch={apiFetch} signedIn={signedIn} identity={accessToken}
          webBase={stack.web} />

        {/* 바로가기 */}
        <Text style={styles.sectionTitle}>바로가기</Text>
        <View style={styles.grid}>
          {!signedIn ? (
            <View style={styles.tile}>
              <TouchableOpacity
                style={styles.tileMain}
                onPress={() => openTab('Schedule')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={SECONDARY} />
                <Text style={styles.tileText}>통독표</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tilePill}
                onPress={() => openWebPath(stack.web, '/plans')}
              >
                <Ionicons name="settings-outline" size={14} color={ACCENT} />
                <Text style={styles.tilePillText}>플랜 관리</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.tile}
              onPress={() => openTab('Schedule')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={SECONDARY} />
              <Text style={styles.tileText}>통독표</Text>
            </TouchableOpacity>
          )}
          <Tile icon="play-outline" label="하세나하시조" onPress={() => openWebPath(stack.web, '/hasena')} />
          <Tile icon="tv-outline" label="개론 영상" onPress={() => openWebPath(stack.web, '/intro')} />
          <Tile icon="people-outline" label="함께" onPress={() => openTab('Together')} />
          {!signedIn && (
            <>
              <Tile icon="trophy-outline" label="리더보드" onPress={() => openWebPath(stack.web, '/scoreboard')} />
              <Tile icon="people-outline" label="친구" onPress={() => openWebPath(stack.web, '/friends')} />
              <Tile icon="time-outline" label="내 활동" onPress={openLogin} />
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 게스트 메뉴 (웹 Menu.vue 대응) */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuScrim}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>메뉴</Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>
            {[
              { label: '공지사항', path: '/notice' },
              { label: '성경읽기', tab: 'Bible' as const },
              { label: '통독표', tab: 'Schedule' as const },
              { label: '플랜 관리', path: '/plans' },
              { label: '리더보드', path: '/scoreboard' },
              { label: '함께', tab: 'Together' as const },
              { label: '친구', path: '/friends' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  if ('tab' in item && item.tab) openTab(item.tab);
                  else if ('path' in item && item.path) openWebPath(stack.web, item.path);
                }}
              >
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); openLogin(); }}>
              <Text style={[styles.menuItemText, { color: ACCENT }]}>로그인</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function HomeAside({ apiFetch, signedIn, identity, webBase }: {
  readonly apiFetch: ApiFetch;
  readonly signedIn: boolean;
  readonly identity: string | null;
  readonly webBase: string;
}) {
  const [hasena, setHasena] = useState<HomeHasena | null>(null);
  const [group, setGroup] = useState<ReturnType<typeof parseFirstHomeGroup>>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasenaError, setHasenaError] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setHasena(null);
    setGroup(null);
    setProgress(null);
    setHasenaError(false);
    setGroupError(false);
    const today = todayKey();
    const query = `year=${today.slice(0, 4)}&month=${Number(today.slice(5, 7))}`;
    const video = async () => {
      try {
        const entry = parseHomeHasena(await readHomeResponse(
          await apiFetch(`/api/v1/todos/hasena/calendar/?${query}`)), today);
        if (active) setHasena(entry);
      } catch {
        if (active) setHasenaError(true);
      }
    };
    const members = async () => {
      if (!signedIn) return;
      try {
        const first = parseFirstHomeGroup(await readHomeResponse(await apiFetch('/api/v1/todos/groups/?only_mine=true')));
        const percent = first?.planId == null ? null : parseHomeGroupProgress(await readHomeResponse(
          await apiFetch(`/api/v1/todos/groups/${first.id}/member-progress/?${query}&plan_id=${first.planId}`)), today);
        if (active) { setGroup(first); setProgress(percent); }
      } catch {
        if (active) setGroupError(true);
      }
    };
    void Promise.all([video(), members()]).then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiFetch, signedIn, identity, webBase, retry]));
  return (
    <>
      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>하세나하시조</Text>
        {loading ? <NativeStateView kind="loading" message="읽기 소식을 불러오는 중…" />
          : hasenaError ? <NativeStateView kind="error" message="하세나를 불러오지 못했습니다." />
            : <TouchableOpacity accessibilityRole="button" accessibilityLabel="하세나 페이지로 이동"
                onPress={() => openWebPath(webBase, '/hasena')}>
                {hasena?.videoId ? <Image testID="home-hasena-image"
                  source={{ uri: `https://i.ytimg.com/vi/${encodeURIComponent(hasena.videoId)}/hqdefault.jpg` }}
                  accessibilityLabel={hasena.title} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }} />
                  : null}
                <Text style={styles.weekTitle}>{hasena?.title || '오늘의 하세나 보기'}</Text>
                {hasena && <Text style={styles.cardDesc}>{hasena.passage}</Text>}
              </TouchableOpacity>}
      </View>
      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>그룹 진도</Text>
        {loading ? <NativeStateView kind="loading" message="그룹 진도를 불러오는 중…" />
          : groupError ? <NativeStateView kind="error" message="그룹 진도를 불러오지 못했습니다." />
            : group ? <>
              <NativeButton label={group.name} onPress={() => openWebPath(webBase, `/groups/${group.id}`)} />
              {progress === null ? <Text style={styles.cardDesc}>오늘 예정된 그룹 통독이 없어요.</Text>
                : <View testID="home-group-progress" accessibilityRole="progressbar"
                    accessibilityLabel="오늘 그룹 멤버 완료율" accessibilityValue={{ min: 0, max: 100, now: progress }}>
                    <Text style={styles.cardDesc}>오늘 멤버 완료율 {progress}%</Text>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: BORDER }}>
                      <View style={{ width: `${progress}%`, height: 8, borderRadius: 4, backgroundColor: ACCENT }} />
                    </View>
                  </View>}
            </> : <NativeButton label="함께 읽을 그룹 찾아보기" onPress={() => openTab('Together')} />}
      </View>
      {(hasenaError || groupError) && <NativeButton label="읽기 소식 다시 불러오기" onPress={() => setRetry(r => r + 1)} />}
    </>
  );
}

function ProgressRing({ progress }: { readonly progress: number }) {
  const size = 88;
  const thickness = 8;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BORDER}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ACCENT}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.ringLabel}>
        {progress}
        <Text style={styles.ringLabelUnit}>%</Text>
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeading}>
        <Ionicons name={icon} size={16} color={ACCENT} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}>{unit}</Text>
      </Text>
    </View>
  );
}

function Tile({
  icon,
  label,
  onPress,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={18} color={SECONDARY} />
      <Text style={styles.tileText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#92400E',
    letterSpacing: -0.4,
  },
  bannerLink: {
    fontFamily: 'Pretendard-SemiBold',
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  logo: {
    height: 22,
    width: 84,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  hero: {
    paddingTop: 20,
    paddingBottom: 4,
    marginBottom: 20,
  },
  greeting: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: SECONDARY,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    color: TEXT,
    letterSpacing: -0.6,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: ACCENT,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  cardPassage: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    color: TEXT,
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  cardDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 19,
    letterSpacing: -0.4,
  },
  welcomeCopy: {
    paddingVertical: 8,
  },
  primaryButton: {
    marginTop: 20,
    height: 44,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.4,
  },
  planSuggestion: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  suggestionText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
  suggestionPlan: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  secondaryButton: {
    backgroundColor: ACCENT_BG,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  statLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  statValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: TEXT,
    letterSpacing: -0.6,
  },
  statUnit: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: TERTIARY,
  },
  weekCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  weekTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: TEXT,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekDay: {
    alignItems: 'center',
    gap: 8,
  },
  weekdayLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: TERTIARY,
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotRead: {
    backgroundColor: ACCENT,
  },
  weekDotToday: {
    backgroundColor: ACCENT_BG,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  weekDotEmpty: {
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  weekDotText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 11,
    color: TERTIARY,
  },
  sectionTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: SECONDARY,
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    backgroundColor: CARD,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tileText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  tilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: ACCENT_BG,
  },
  tilePillText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  ringLabel: {
    position: 'absolute',
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: TEXT,
    letterSpacing: -0.6,
  },
  ringLabelUnit: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  menuScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  menuTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.4,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  menuItemText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
});
