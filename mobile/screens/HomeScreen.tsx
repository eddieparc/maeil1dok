import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { NativeButton } from '../components/ui/NativeButton';
import { NativeStateView } from '../components/ui/NativeStateView';
import { useNativeColors, useNativeTheme } from '../components/ui/tokens';
import { useReadingSettings } from '../components/bible/ReadingSettingsProvider';
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
  parseHomeUser,
  parseProgress,
  parseStreak,
  parseUnreadNotifications,
  type CalendarEntry,
  type HomeUser,
} from '../api/homeData';

const SERIF = 'NotoSerifKR-Bold';

const SERIF_STYLE = { fontFamily: SERIF };

/*
 * Home's Lucide 1.20 outlines, rendered with the existing react-native-svg.
 * ISC License. Copyright (c) 2026 Lucide Icons and Contributors.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Feather-derived outlines: MIT License, Copyright (c) 2013-present Cole Bemis.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const HOME_ICON_PATHS = {
  'notifications-outline': 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  menu: 'M4 5h16 M4 12h16 M4 19h16',
  moon: 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42',
  close: 'M18 6 6 18 M6 6l12 12',
  'information-circle': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 16v-4 M12 8h.01',
  'calendar-outline': 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  'calendar-check': 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M9 16l2 2 4-4',
  'flame-outline': 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4',
  'book-outline': 'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  checkmark: 'm20 6-11 11-5-5',
  'settings-outline': 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  'play-outline': 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z',
  'tv-outline': 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 M12 17v4 M8 21h8',
  'people-outline': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  'trophy-outline': 'M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978 M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978 M18 9h1.5a1 1 0 0 0 0-5H18 M4 22h16 M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z M6 9H4.5a1 1 0 0 1 0-5H6',
  'time-outline': 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2',
  'message-circle': 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
  'clipboard-list': 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1 M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M12 11h4 M12 16h4 M8 11h.01 M8 16h.01',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'user-plus': 'M2 21a8 8 0 0 1 13.292-6 M15 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M19 16v6 M22 19h-6',
  'chevron-forward': 'm9 18 6-6-6-6',
} as const;

function HomeIcon({ name, size, color }: {
  readonly name: keyof typeof HOME_ICON_PATHS;
  readonly size: number;
  readonly color: string;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={name === 'checkmark' ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    <Path d={HOME_ICON_PATHS[name]} />
  </Svg>;
}

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
  readonly primaryPlanId: number | null;
}

export default function HomeScreen() {
  const palette = useNativeColors();
  const theme = useNativeTheme();
  const readingSettings = useReadingSettings();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(palette, width), [palette, width]);
  const { text: TEXT, accent: ACCENT, textSecondary: SECONDARY } = palette;
  const wide = width >= 1024;
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
  const [unread, setUnread] = useState(0);
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
    setData(previous => previous && {
      ...previous, streak: null, calendar: [], planCards: [], primaryPlanId: null,
    });
    try {
      const user = parseHomeUser(await readHomeResponse(await apiFetch('/api/v1/auth/user/')));
      if (!user) throw new Error('user parse');
      if (generation.current !== request) return;
      const initial: DashboardData = {
        user, streak: null, calendar: [], planCards: [], availablePlans: [],
        primaryPlanId: null,
      };
      setData(initial);

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

      const [plansRes, profileRes, ...calResponses] = await Promise.all([
        apiFetch('/api/v1/todos/plans/user/'),
        apiFetch(`/api/v1/auth/profile/${user.id}/`),
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

      const activeSubs = subscriptions.filter(
        (s: { is_active?: boolean }) => s.is_active,
      );
      const primaryPlanId = pickEffectivePlanId(activeSubs);
      if (generation.current !== request) return;
      const partial = { ...initial, streak, calendar, availablePlans, primaryPlanId };
      setData(partial);
      const cardSubs = activeSubs.slice(0, 3);
      const cardResults = await Promise.all(
        cardSubs.map(async (sub) => {
          const progRes = await apiFetch(`/api/v1/todos/stats/progress/?plan_id=${sub.plan_id}`);
          const progressJson = await readHomeResponse(progRes);
          if (!progressJson || typeof progressJson !== 'object' || !('user_progress' in progressJson)
            || typeof progressJson.user_progress !== 'number') throw new Error('Invalid progress');
          const progress = parseProgress(progressJson);
          const finalDate = 'end_date' in progressJson && typeof progressJson.end_date === 'string'
            ? progressJson.end_date : null;
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
        ...partial,
        planCards: cardResults,
      });
    } catch (error) {
      if (generation.current === request) {
        setError(error instanceof Error ? error.message : '읽기 기록을 불러오지 못했습니다.');
      }
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

  useFocusEffect(useCallback(() => {
    let active = true;
    setUnread(0);
    if (signedIn) {
      void apiFetch('/api/v1/todos/notifications/')
        .then(readHomeResponse)
        .then(json => { if (active) setUnread(parseUnreadNotifications(json)); })
        .catch(() => {
          // Inbox failure must not discard the independent reading dashboard.
          if (active) setUnread(0);
        });
    }
    return () => { active = false; };
  }, [signedIn, apiFetch, stack, accessToken, retry]));

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
    () => data ? data.calendar.filter((e) => e.plan_id === data.primaryPlanId) : [],
    [data],
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
          <HomeIcon name="information-circle" size={18} color="#92400E" />
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
            <HomeIcon name="close" size={18} color="#92400E" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarInset }]}
      >
        {/* 헤더 */}
        <View testID="home-header" style={styles.header}>
          {!wide && <Image
            key={theme}
            source={require('../assets/logo.png')}
            style={styles.logo}
            tintColor={theme === 'dark' ? '#FFFFFF' : undefined}
            resizeMode="contain"
          />}
          <View style={styles.headerActions}>
            {signedIn ? (
              <>
                <TouchableOpacity
                  testID="home-notifications"
                  style={styles.headerIcon}
                  accessibilityRole="button"
                  accessibilityLabel={unread ? `알림, 읽지 않은 알림 ${unread}개` : '알림'}
                  onPress={() => openWebPath(stack.web, '/notifications')}
                  hitSlop={8}
                >
                  <HomeIcon name="notifications-outline" size={20} color={TEXT} />
                  {unread > 0 && <View style={styles.badgeDot} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIcon}
                  accessibilityRole="button"
                  accessibilityLabel="내 정보"
                  hitSlop={8}
                  onPress={() => openTab('Profile')}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(displayName ?? '나').slice(0, 1)}</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.headerIcon}
                  accessibilityRole="button"
                  accessibilityLabel={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                  testID="home-theme-toggle"
                  onPress={() => { void readingSettings.update('theme', theme === 'dark' ? 'light' : 'dark'); }}
                  hitSlop={8}
                >
                  <HomeIcon name={theme === 'dark' ? 'sun' : 'moon'} size={20} color={TEXT} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIcon}
                  accessibilityRole="button"
                  accessibilityLabel="메뉴 열기"
                  testID="home-menu-open"
                  onPress={() => setMenuOpen(true)}
                  hitSlop={8}
                >
                  <HomeIcon name="menu" size={22} color={TEXT} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View testID="home-dashboard" style={styles.dashboard}>
        <View testID="home-main" style={styles.mainColumn}>
        {/* 히어로 */}
        <View testID="home-hero" style={styles.hero}>
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
          <View testID="home-loading" style={styles.card} accessibilityLabel="읽기 기록을 불러오는 중"
            accessibilityState={{ busy: true }}>
            <View style={styles.cardRow}>
              <HomeSkeleton width={wide ? 120 : 88} height={wide ? 120 : 88} circle />
              <View style={styles.cardCopy}>
                <HomeSkeleton width={120} height={12} />
                <View style={{ height: 8 }} />
                <HomeSkeleton width="100%" height={22} />
                <View style={{ height: 8 }} />
                <HomeSkeleton width="80%" height={13} />
              </View>
            </View>
            <View style={{ marginTop: 20 }}><HomeSkeleton width="100%" height={44} /></View>
          </View>
        ) : signedIn && error ? (
          <View testID="home-error" style={styles.loadError} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
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
                  testID="home-empty-schedule"
                  accessibilityRole="button"
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
              testID="home-login"
              accessibilityRole="button"
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
        {signedIn && (
          <>
            <View testID="home-stats" accessibilityValue={{ text: `${loading || error ? '-' : weeklyCompleted}/7` }}
              accessibilityState={{ busy: loading }} style={styles.statsRow}>
              <StatCard icon="flame-outline" label="연속" value={`${data?.streak ?? '-'}`} unit="일" loading={loading} />
              <StatCard icon="calendar-check" label="이번 주" value={`${error ? '-' : weeklyCompleted}`} unit="/7" loading={loading} />
              <StatCard
                icon="book-outline"
                label="완독까지"
                value={primaryCard?.remainingDays != null ? `${primaryCard.remainingDays}` : '-'}
                unit="일"
                loading={loading}
              />
            </View>
            {wide && <View testID="home-recent" style={[styles.weekCard, styles.asideCard]}>
              <Text style={styles.weekTitle}>최근 기록</Text>
              {loading ? <HomeSkeleton width="100%" height={44} />
                : error ? <Text style={styles.cardDesc}>기록을 불러오지 못했습니다.</Text>
                : recentRecords.length ? recentRecords.map(record => (
                <TouchableOpacity key={record.schedule_id} testID={`home-recent-${record.schedule_id}`}
                  accessibilityRole="button" onPress={() => openTab('Schedule')}
                  style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <HomeIcon name="checkmark" size={16} color={ACCENT} />
                  <Text style={[styles.cardDesc, { flex: 1 }]}>
                    {record.book} {record.start_chapter === record.end_chapter ? record.start_chapter
                      : `${record.start_chapter}-${record.end_chapter}`}{record.book === '시편' ? '편' : '장'}
                  </Text>
                  <Text style={styles.cardDesc}>{record.date.slice(5).replace('-', '.')}</Text>
                </TouchableOpacity>
              )) : <Text style={styles.cardDesc}>최근 완료한 통독 기록이 없어요.</Text>}
            </View>}
          </>
        )}
        </View>
        {signedIn && <View testID="home-aside" style={styles.asideColumn}>
            <View testID="home-week" style={styles.weekCard} accessibilityState={{ busy: loading }}>
              <Text style={styles.weekTitle}>이번 주</Text>
              <View style={styles.weekRow}>
                {week.map((day) => (
                  <View key={day.date} testID={`home-day-${day.date}`} style={styles.weekDay}
                    accessibilityLabel={`${day.date} ${loading ? '확인 중' : error ? '확인할 수 없음' : { read: '읽음', today: '오늘', upcoming: '예정', missed: '읽지 않음' }[day.state]}`}>
                    <Text style={[styles.weekdayLabel, day.isToday && { color: ACCENT }]}>
                      {day.label}
                    </Text>
                    {loading ? <HomeSkeleton width={28} height={28} circle /> : <View
                      style={[
                        styles.weekDot,
                        !error && day.state === 'read' && styles.weekDotRead,
                        !error && day.state === 'today' && styles.weekDotToday,
                        (error || day.state === 'upcoming' || day.state === 'missed') &&
                          styles.weekDotEmpty,
                        (error || day.state === 'upcoming') && { borderStyle: 'dashed' },
                      ]}
                    >
                      {day.state === 'read' && !error ? (
                        <HomeIcon name="checkmark" size={14} color={palette.onAccent} />
                      ) : (
                        <Text
                          style={[
                            styles.weekDotText,
                            !error && day.state === 'today' && { color: ACCENT },
                          ]}
                        >
                          {day.number}
                        </Text>
                      )}
                    </View>}
                  </View>
                ))}
              </View>
            </View>
        {wide && <HomeAside apiFetch={apiFetch} signedIn={signedIn} identity={accessToken}
          webBase={stack.web} />}
        </View>}
        </View>

        {/* 바로가기 */}
        <View testID="home-shortcuts" style={styles.shortcutColumn}>
        <Text style={styles.sectionTitle}>바로가기</Text>
        <View style={styles.grid}>
          {!signedIn ? (
            <View style={[styles.tile, styles.planTile]}>
              <TouchableOpacity
                testID="home-shortcut-schedule"
                accessibilityRole="button"
                style={styles.tileMain}
                onPress={() => openTab('Schedule')}
                activeOpacity={0.8}
              >
                <HomeIcon name="calendar-outline" size={18} color={SECONDARY} />
                <Text style={styles.tileText}>통독표</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="home-shortcut-plans"
                accessibilityRole="button"
                style={styles.tilePill}
                onPress={() => openWebPath(stack.web, '/plans')}
              >
                <HomeIcon name="settings-outline" size={14} color={SECONDARY} />
                <Text style={styles.tilePillText}>플랜 관리</Text>
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>N</Text></View>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              testID="home-shortcut-schedule"
              accessibilityRole="button"
              style={styles.tile}
              onPress={() => openTab('Schedule')}
              activeOpacity={0.8}
            >
              <HomeIcon name="calendar-outline" size={18} color={SECONDARY} />
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
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* 게스트 메뉴 (웹 Menu.vue 대응) */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.menuScrim}>
          <Pressable testID="home-menu-backdrop" accessibilityRole="button" accessibilityLabel="메뉴 닫기"
            style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <SafeAreaView style={styles.menuSheet} edges={['top', 'bottom']} accessibilityViewIsModal>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>메뉴</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="메뉴 닫기"
                onPress={() => setMenuOpen(false)} style={styles.headerIcon}>
                <HomeIcon name="close" size={24} color={SECONDARY} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.menuItems}>
            {([
              { label: '공지사항', icon: 'message-circle', path: '/notice' },
              { label: '오늘일독', icon: 'book-outline', tab: 'Bible' },
              { label: '성경통독표', icon: 'clipboard-list', tab: 'Schedule' },
              { label: '플랜 관리', icon: 'calendar-outline', path: '/plans' },
              { label: '리더보드', icon: 'list', path: '/scoreboard' },
              { label: '그룹', icon: 'people-outline', tab: 'Together' },
              { label: '친구', icon: 'user-plus', path: '/friends' },
            ] as const).map((item, index) => (
              <View key={item.label}>
              {index === 4 && <View style={styles.menuDivider} />}
              <TouchableOpacity
                accessibilityRole="button"
                testID={`home-menu-${index}`}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  if ('tab' in item && item.tab) openTab(item.tab);
                  else if ('path' in item && item.path) openWebPath(stack.web, item.path);
                }}
              >
                <HomeIcon name={item.icon} size={24} color={TEXT} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
              </View>
            ))}
            </ScrollView>
            <View style={styles.menuFooter}>
              {[
                { label: '이용약관', path: '/terms' },
                { label: '개인정보처리방침', path: '/privacy' },
                { label: '회사정보', path: '/company' },
              ].map((item, index) => (
                <View key={item.path} style={styles.legalItem}>
                  {index > 0 && <Text style={styles.legalDivider}>|</Text>}
                  <TouchableOpacity accessibilityRole="button" testID={`home-menu-${item.path}`}
                    onPress={() => { setMenuOpen(false); openWebPath(stack.web, item.path); }}
                    style={styles.legalLink}>
                    <Text style={styles.legalText}>{item.label}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </SafeAreaView>
        </View>
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
  const palette = useNativeColors();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { accent: ACCENT } = palette;
  const [hasena, setHasena] = useState<HomeHasena | null>(null);
  const [group, setGroup] = useState<ReturnType<typeof parseFirstHomeGroup>>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [hasenaLoading, setHasenaLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(true);
  const [hasenaError, setHasenaError] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setHasenaLoading(true);
    setGroupLoading(signedIn);
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
      } finally {
        if (active) setHasenaLoading(false);
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
      } finally {
        if (active) setGroupLoading(false);
      }
    };
    void video();
    void members();
    return () => { active = false; };
  }, [apiFetch, signedIn, identity, webBase, retry]));
  return (
    <>
      <View style={[styles.weekCard, styles.asideCard]}>
        <Text style={styles.weekTitle}>하세나하시조</Text>
        {hasenaLoading ? <NativeStateView kind="loading" message="읽기 소식을 불러오는 중…" />
          : hasenaError ? <NativeStateView kind="error" message="하세나를 불러오지 못했습니다." />
            : <TouchableOpacity accessibilityRole="button" accessibilityLabel="하세나 페이지로 이동"
                onPress={() => openWebPath(webBase, '/hasena')} style={{ gap: 10 }}>
                {hasena?.videoId ? <Image testID="home-hasena-image"
                  source={{ uri: `https://i.ytimg.com/vi/${encodeURIComponent(hasena.videoId)}/hqdefault.jpg` }}
                  accessibilityLabel={hasena.title} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12 }} />
                  : null}
                <Text style={[styles.weekTitle, { fontSize: 14, lineHeight: 19.6, marginBottom: 0 }]}>{hasena?.title || '오늘의 하세나 보기'}</Text>
                {hasena && <Text style={styles.cardDesc}>{hasena.passage}</Text>}
              </TouchableOpacity>}
      </View>
      <View style={[styles.weekCard, styles.asideCard, { marginBottom: hasenaError || groupError ? 20 : 0 }]}>
        <View style={styles.asideHeading}>
          <HomeIcon name="people-outline" size={18} color={palette.text} />
          <Text style={[styles.weekTitle, { marginBottom: 0 }]}>그룹 진도</Text>
        </View>
        {groupLoading ? <NativeStateView kind="loading" message="그룹 진도를 불러오는 중…" />
          : groupError ? <NativeStateView kind="error" message="그룹 진도를 불러오지 못했습니다." />
            : group ? <>
              <TouchableOpacity testID="home-group-link" accessibilityRole="button" accessibilityLabel={group.name} style={styles.groupLink}
                onPress={() => openWebPath(webBase, `/groups/${group.id}`)}>
                <Text style={styles.groupLinkText}>{group.name}</Text>
                <HomeIcon name="chevron-forward" size={18} color={palette.text} />
              </TouchableOpacity>
              {progress === null ? <Text style={styles.cardDesc}>오늘 예정된 그룹 통독이 없어요.</Text>
                : <View testID="home-group-progress" accessibilityRole="progressbar"
                    accessibilityLabel="오늘 그룹 멤버 완료율" accessibilityValue={{ min: 0, max: 100, now: progress }}>
                    <View style={styles.groupProgressLabel}>
                      <Text style={styles.groupProgressText}>오늘 멤버 완료율</Text>
                      <Text style={[styles.groupProgressText, { color: ACCENT, fontFamily: 'Pretendard-Bold' }]}>{progress}%</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: palette.surfaceMuted }}>
                      <View style={{ width: `${progress}%`, height: 8, borderRadius: 4, backgroundColor: ACCENT }} />
                    </View>
                  </View>}
            </> : <TouchableOpacity testID="home-group-link" accessibilityRole="button" accessibilityLabel="함께 읽을 그룹 찾아보기"
              style={styles.groupLink} onPress={() => openTab('Together')}>
              <Text style={styles.groupLinkText}>함께 읽을 그룹 찾아보기</Text>
              <HomeIcon name="chevron-forward" size={18} color={palette.text} />
            </TouchableOpacity>}
      </View>
      {(hasenaError || groupError) && <NativeButton label="읽기 소식 다시 불러오기" onPress={() => setRetry(r => r + 1)} />}
    </>
  );
}

function ProgressRing({ progress }: { readonly progress: number }) {
  const palette = useNativeColors();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { width } = useWindowDimensions();
  const size = width >= 1024 ? 120 : 88;
  const thickness = width >= 1024 ? 10 : 8;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  return (
    <View testID="home-progress-ring" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.border}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.accent}
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
  loading,
}: {
  readonly icon: keyof typeof HOME_ICON_PATHS;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly loading: boolean;
}) {
  const palette = useNativeColors();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(palette, width), [palette, width]);
  return (
    <View testID={`home-stat-${icon}`} style={styles.statCard}
      accessibilityValue={{ text: loading ? undefined : `${value}${unit}` }}>
      <View style={styles.statHeading}>
        <HomeIcon name={icon} size={16} color={icon === 'flame-outline' ? palette.accent : palette.textSecondary} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {loading ? <HomeSkeleton width={64} height={24} /> : <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={[styles.statUnit, unit === '/7' && { color: palette.textMuted }]}>{unit}</Text>
      </View>}
    </View>
  );
}

function Tile({
  icon,
  label,
  onPress,
}: {
  readonly icon: keyof typeof HOME_ICON_PATHS;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const palette = useNativeColors();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(palette, width), [palette, width]);
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
      style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <HomeIcon name={icon} size={18} color={palette.textSecondary} />
      <Text style={styles.tileText}>{label}</Text>
    </TouchableOpacity>
  );
}

function HomeSkeleton({ width, height, circle = false }: {
  readonly width: number | `${number}%`;
  readonly height: number;
  readonly circle?: boolean;
}) {
  const palette = useNativeColors();
  return <View accessible={false} style={{ width, height, borderRadius: circle ? height / 2 : 4,
    backgroundColor: palette.surfaceMuted }} />;
}

function createStyles(palette: ReturnType<typeof useNativeColors>, width = 440) {
  const { background: BG, surface: CARD, text: TEXT, textSecondary: SECONDARY,
    textMuted: TERTIARY, border: BORDER, accent: ACCENT, accentSurface: ACCENT_BG } = palette;
  const dark = BG === '#1a1a1a';
  const wide = width >= 1024;
  // The native navigator already owns the 240px sidebar.
  const mainWidth = wide ? Math.min(760, width - 240 - 80 - 300 - 28)
    : Math.min(width, 768) - 40;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: wide ? 40 : 20,
    paddingTop: wide ? 36 : 0,
    width: '100%',
    maxWidth: wide ? 1168 : 768,
    alignSelf: 'center',
  },
  dashboard: { flexDirection: wide ? 'row' : 'column', columnGap: wide ? 28 : 0 },
  mainColumn: { minWidth: 0, ...(wide ? { width: mainWidth, maxWidth: 760, flexShrink: 1 } : {}) },
  asideColumn: { ...(wide ? { width: 300, flexShrink: 0 } : {}) },
  shortcutColumn: { ...(wide ? { width: mainWidth, marginTop: 28 } : {}) },
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
    justifyContent: wide ? 'flex-end' : 'space-between',
    height: 52,
    marginBottom: wide ? 20 : 0,
  },
  logo: {
    height: 22,
    width: 84,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: BG,
    borderRadius: 5,
    backgroundColor: ACCENT,
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
    fontFamily: 'Pretendard-Bold',
    fontSize: 13,
    color: palette.onAccent,
  },
  hero: {
    paddingTop: 20,
    paddingBottom: 4,
    marginBottom: 20,
  },
  greeting: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: SECONDARY,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroTitle: {
    fontSize: wide ? 30 : 26,
    lineHeight: wide ? 37.5 : 33.8,
    color: TEXT,
    letterSpacing: wide ? -0.8 : -0.6,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    boxShadow: dark ? undefined : '0px 1px 2px rgba(0, 0, 0, 0.04)',
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
    lineHeight: 16.8,
    color: ACCENT,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  cardPassage: {
    fontSize: 20,
    lineHeight: 26,
    color: TEXT,
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  cardDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 19.5,
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
    color: palette.onAccent,
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
    backgroundColor: dark ? 'transparent' : ACCENT_BG,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: dark ? 1.5 : 1,
    borderColor: dark ? ACCENT : BORDER,
    borderRadius: 10,
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  loadError: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 19.5,
    letterSpacing: -0.4,
    color: palette.error,
    flexShrink: 1,
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
    boxShadow: dark ? undefined : '0px 1px 2px rgba(0, 0, 0, 0.04)',
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
    lineHeight: 16.8,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  statValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: wide ? 28 : 24,
    lineHeight: wide ? 28 : 24,
    color: TEXT,
    letterSpacing: -0.6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statUnit: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 13,
  },
  weekCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    boxShadow: dark ? undefined : '0px 1px 2px rgba(0, 0, 0, 0.04)',
  },
  weekTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    lineHeight: 22.5,
    color: TEXT,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  asideCard: { paddingVertical: 18, paddingHorizontal: 20 },
  asideHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  groupLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  groupLinkText: { flexShrink: 1, fontFamily: 'Pretendard-Bold', fontSize: 14, color: TEXT, lineHeight: 21, letterSpacing: -0.4 },
  groupProgressLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12, marginBottom: 8 },
  groupProgressText: { fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18, color: SECONDARY },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  weekdayLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 11,
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
    fontFamily: 'NotoSerifKR-SemiBold',
    fontSize: 13,
    lineHeight: 18.2,
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
    width: (mainWidth - 8) / 2,
    flexGrow: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    backgroundColor: CARD,
    boxShadow: dark ? undefined : '0px 1px 2px rgba(0, 0, 0, 0.04)',
  },
  planTile: {
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 0,
  },
  tileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  tileText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: TEXT,
    letterSpacing: -0.4,
  },
  tilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: ACCENT_BG,
  },
  newBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadgeText: {
    fontFamily: 'Pretendard-Bold',
    color: palette.onAccent,
    fontSize: 10,
    lineHeight: 10,
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
    backgroundColor: palette.scrim,
    alignItems: 'flex-end',
  },
  menuSheet: {
    flex: 1,
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD,
    padding: 16,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  menuTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: TEXT,
    letterSpacing: -0.4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItems: { flex: 1, paddingHorizontal: 8 },
  menuDivider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  menuFooter: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: BORDER },
  legalItem: { flexDirection: 'row', alignItems: 'center' },
  legalLink: { minHeight: 44, justifyContent: 'center' },
  legalText: { fontFamily: 'Pretendard-Regular', fontSize: 12, color: SECONDARY },
  legalDivider: { marginHorizontal: 8, color: TERTIARY },
  menuItemText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
  });
}
