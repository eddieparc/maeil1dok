import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef, type RootStackParamList, type TabParamList } from './navigationRef';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from './AppStackContext';
import { parseUser } from '../api/moreData';
import HomeScreen from '../screens/HomeScreen';
import BibleScreen from '../screens/BibleScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import WebViewScreen from '../screens/WebViewScreen';
import WebViewTabScreen from '../screens/WebViewTabScreen';
import LoginScreen from '../screens/LoginScreen';
import { hasNativeTabBar, NativeTabBar } from './NativeTabBar';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Bible: 'book-outline',
  Schedule: 'calendar-outline',
  Together: 'people-outline',
  Profile: 'person-circle-outline',
};

function TogetherTab() {
  return <WebViewTabScreen path="/groups" />;
}

/**
 * 내 정보 탭 — 웹의 /profile/:id. 로그인 상태면 사용자 id를 조회해 WebView로
 * 열고, 게스트면 로그인 유도 화면을 보여준다(웹은 /login으로 리다이렉트한다 —
 * 네이티브는 모달을 띄우는 대신 탭 안에서 유도해 뒤로가기 상태를 망가뜨리지
 * 않는다).
 */
function ProfileTab() {
  const { status, apiFetch } = useAuth();
  const { betaMode, setBetaMode } = useAppStack();
  const [userId, setUserId] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const handleBetaToggle = useCallback(async (enabled: boolean) => {
    try {
      await setBetaMode(enabled);
    } catch (error: unknown) {
      Alert.alert('베타 전환 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    }
  }, [setBetaMode]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    let cancelled = false;
    apiFetch('/api/v1/auth/user/')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const user = parseUser(json);
        if (user) setUserId(user.id);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, apiFetch]);

  if (status === 'loading' || (status === 'signedIn' && !userId && !failed)) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2A1111" />
      </View>
    );
  }

  if (status !== 'signedIn' || failed || !userId) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.emptyText}>로그인이 필요합니다</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (navigationRef.isReady()) navigationRef.navigate('Login');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>로그인</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.emptyText}>베타 모드</Text>
          <Switch
            style={{ width: 51, height: 31 }}
            accessibilityLabel="베타 모드"
            value={betaMode === true}
            onValueChange={handleBetaToggle}
          />
        </View>
      </View>
    );
  }

  return <WebViewTabScreen path={`/profile/${userId}`} />;
}

/**
 * 웹 BottomNavigation과 동일한 탭 바: 84px 콘텐츠 + safe-area inset,
 * 흰 배경, 상단 hairline, 11px 라벨, 활성 #2A1111 / 비활성 #9B928A.
 */
function WebTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const labels: Record<keyof TabParamList, string> = {
    Home: '홈',
    Bible: '성경',
    Schedule: '통독표',
    Together: '함께',
    Profile: '내 정보',
  };
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? '#2A1111' : '#9B928A';
        const name = route.name as keyof TabParamList;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          >
            <Ionicons name={TAB_ICONS[name]} size={22} color={color} />
            <Text
              style={[
                styles.tabLabel,
                { color, fontFamily: focused ? 'Pretendard-SemiBold' : 'Pretendard-Medium' },
              ]}
            >
              {labels[name]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      // eslint-disable-next-line react/no-unstable-nested-components
      tabBar={(props) => hasNativeTabBar ? <NativeTabBar {...props} /> : <WebTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Bible" component={BibleScreen} options={{ title: '성경' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: '통독표' }} />
      <Tab.Screen name="Together" component={TogetherTab} options={{ title: '함께' }} />
      <Tab.Screen name="Profile" component={ProfileTab} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator({ onReady }: { readonly onReady?: () => void }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2A1111" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onReady}>
      <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E9E4DE',
    paddingTop: 6,
    paddingHorizontal: 8,
    height: 60 + 24,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.4,
    lineHeight: 11,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#FAF8F5',
  },
  emptyText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#6B625B',
    letterSpacing: -0.4,
  },
  primaryButton: {
    backgroundColor: '#2A1111',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.4,
  },
});
