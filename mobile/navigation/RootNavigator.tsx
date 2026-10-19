import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef, type RootStackParamList, type TabParamList } from './navigationRef';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from './AppStackContext';
import { ReadingSettingsProvider } from '../components/bible/ReadingSettingsProvider';
import HomeScreen from '../screens/HomeScreen';
import BibleScreen from '../screens/BibleScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import WebViewScreen from '../screens/WebViewScreen';
import TogetherScreen from '../screens/TogetherScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
      <Tab.Screen name="Together" component={TogetherScreen} options={{ title: '함께' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator({ onReady }: { readonly onReady?: () => void } = {}) {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack } = useAppStack();
  // This is a cache identity, not token validation. AuthSession owns authentication;
  // the backend's SIMPLE_JWT.USER_ID_CLAIM is user_id. Never retain/log credentials.
  let accountId: string | null = null;
  if (status === 'signedIn' && accessToken) {
    try {
      const payload = accessToken.split('.')[1];
      if (payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
        if (typeof claims === 'object' && claims !== null && 'user_id' in claims) {
          const id = claims.user_id;
          if ((typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
            || (typeof id === 'string' && /^[1-9]\d*$/.test(id))) accountId = String(id);
        }
      }
    } catch (error) {
      // An unreadable identity must not reuse another account or become a guest.
      if (!(error instanceof Error)) throw error;
      accountId = null;
    }
  }
  const session = status === 'signedOut'
    ? { key: `guest:${stack.api}`, apiFetch: null }
    : accountId === null ? null : { key: `account:${stack.api}:${accountId}`, apiFetch };

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2A1111" />
      </View>
    );
  }

  return (
    <ReadingSettingsProvider session={session}>
      {status === 'signedIn' && accountId === null && (
        <Text accessibilityRole="alert">읽기 설정 계정을 확인할 수 없습니다. 다시 로그인해 주세요.</Text>
      )}
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
    </ReadingSettingsProvider>
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
});
