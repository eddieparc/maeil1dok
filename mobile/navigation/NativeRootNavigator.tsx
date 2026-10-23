import { ActivityIndicator, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { NativeTabBar } from './NativeTabBar';
import { useNativeColors } from '../components/ui/tokens';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function WebMatchedChrome() {
  const insets = useSafeAreaInsets();
  // The existing WebView shell keeps its outer safe areas cream in both themes.
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
      <View testID="native-safe-top" pointerEvents="none"
        style={[styles.safeTop, { height: insets.top }]} />
    </>
  );
}

function MainTabs() {
  const { status } = useAuth();
  const { width } = useWindowDimensions();
  const colors = useNativeColors();
  return (
    <Tab.Navigator
      // eslint-disable-next-line react/no-unstable-nested-components
      tabBar={(props) => <NativeTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarPosition: width >= 1024 ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Bible" component={BibleScreen} options={{ title: '성경' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: '통독표' }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            const state = navigation.getState();
            const current = state.routes[state.index];
            if (current.name !== 'Bible' || !current.params
              || !('readerActive' in current.params) || current.params.readerActive !== true) return;
            event.preventDefault();
            navigation.navigate('Bible', { ...current.params, openSchedule: true });
          },
        })} />
      <Tab.Screen name="Together" component={TogetherScreen} options={{ title: '함께' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보' }}
        listeners={{
          tabPress: (event) => {
            if (status !== 'signedOut') return;
            event.preventDefault();
            if (navigationRef.isReady()) navigationRef.navigate('Login');
          },
        }} />
    </Tab.Navigator>
  );
}

export default function NativeRootNavigator({ onReady }: { readonly onReady?: () => void } = {}) {
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
    <WebMatchedChrome />
    </ReadingSettingsProvider>
  );
}

const styles = StyleSheet.create({
  safeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: '#FAF8F5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
});
