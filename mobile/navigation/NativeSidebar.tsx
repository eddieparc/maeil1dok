import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthSession';
import { parseUser, type MoreUser } from '../api/moreData';
import { parseUnreadNotifications } from '../api/homeData';
import { useNativeColors, useNativeTheme } from '../components/ui/tokens';
import { useAppStack } from './AppStackContext';
import { navigationRef, type TabParamList } from './navigationRef';

const secondary = {
  Hasena: { label: '하세나하시조', path: '/hasena', icon: 'm6 3 14 9-14 9V3z' },
  Intro: { label: '개론 영상', path: '/intro', icon: 'M8 21h8 M12 17v4 M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' },
  Notifications: { label: '알림', path: '/notifications', icon: 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' },
} as const;

export function NativeSidebar({ state, items, onTabSelect }: {
  readonly state: BottomTabBarProps['state'];
  readonly items: Readonly<Record<keyof TabParamList, { readonly label: string; readonly path: string }>>;
  readonly onTabSelect: (index: number) => void;
}) {
  const palette = useNativeColors();
  const theme = useNativeTheme();
  const { stack } = useAppStack();
  const { status, apiFetch } = useAuth();
  const [user, setUser] = useState<MoreUser | null>(null);
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setUser(null);
    setUnread(0);
    if (status === 'signedIn') {
      void apiFetch('/api/v1/auth/user/')
        .then(response => response.ok ? response.json() : null)
        .then(json => { if (active) setUser(parseUser(json)); })
        .catch((error: unknown) => {
          if (!(error instanceof Error)) throw error;
          if (active) setUser(null);
        });
      void apiFetch('/api/v1/todos/notifications/')
        .then(response => response.ok ? response.json() : null)
        .then(json => { if (active) setUnread(parseUnreadNotifications(json)); })
        .catch((error: unknown) => {
          if (!(error instanceof Error)) throw error;
          if (active) setUnread(0);
        });
    }
    return () => { active = false; };
  }, [status, apiFetch]));

  const primary = (name: keyof TabParamList) => {
    const index = state.routes.findIndex(route => route.name === name);
    const selected = state.index === index;
    const color = selected ? palette.onAccent : palette.textSecondary;
    return (
      <Pressable key={name} testID={`sidebar-${name}`} accessibilityRole="tab"
        accessibilityLabel={items[name].label} accessibilityState={{ selected }}
        onPress={() => onTabSelect(index)}
        style={({ pressed }) => [styles.item, {
          backgroundColor: selected ? palette.accent : pressed ? palette.surfacePressed : 'transparent',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color}
          strokeWidth={selected ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
          <Path d={items[name].path} />
          {name === 'Schedule' && <Rect width={18} height={18} x={3} y={4} rx={2} />}
          {name === 'Together' && <Circle cx={9} cy={7} r={4} />}
        </Svg>
        <Text style={[styles.label, { color,
          fontFamily: selected ? 'Pretendard-SemiBold' : 'Pretendard-Medium',
        }]}>{items[name].label}</Text>
      </Pressable>
    );
  };
  const link = (name: keyof typeof secondary) => {
    const item = secondary[name];
    const count = name === 'Notifications' && status === 'signedIn' ? unread : 0;
    return (
      <Pressable testID={`sidebar-${name}`} accessibilityRole="link"
        accessibilityLabel={count > 0 ? `읽지 않은 알림 ${count}개` : item.label}
        onPress={() => {
          if (navigationRef.isReady()) navigationRef.navigate('WebView', { url: `${stack.web}${item.path}` });
        }}
        style={({ pressed }) => [styles.item, {
          backgroundColor: pressed ? palette.surfacePressed : 'transparent',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.textSecondary}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
          <Path d={item.icon} />
        </Svg>
        <Text style={[styles.label, { color: palette.textSecondary }]}>{item.label}</Text>
        {count > 0 && <Text style={[styles.count, {
          color: palette.accent, backgroundColor: palette.accentSurface,
        }]}>{count}</Text>}
      </Pressable>
    );
  };
  const profileSelected = state.routes[state.index].name === 'Profile';
  const signedInUser = status === 'signedIn' ? user : null;
  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} testID="native-sidebar"
      style={[styles.sidebar, { backgroundColor: palette.surface, borderRightColor: palette.border }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="매일일독 홈"
          onPress={() => onTabSelect(state.routes.findIndex(route => route.name === 'Home'))}
          style={({ pressed }) => [styles.brand, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <Image key={theme} source={require('../assets/logo.png')} resizeMode="contain"
            style={[styles.logo, theme === 'dark' && { tintColor: '#FFFFFF' }]} accessible={false} />
        </Pressable>
        <View style={styles.menu}>
          {primary('Home')}
          {primary('Bible')}
          {primary('Schedule')}
          {link('Hasena')}
          {primary('Together')}
          {link('Intro')}
        </View>
        <View style={styles.footer}>
          {link('Notifications')}
          <Pressable testID="sidebar-Profile" accessibilityRole="tab" accessibilityLabel={items.Profile.label}
            accessibilityState={{ selected: profileSelected }}
            onPress={() => onTabSelect(state.routes.findIndex(route => route.name === 'Profile'))}
            style={({ pressed }) => [styles.item, styles.profile, {
              backgroundColor: pressed ? palette.surfacePressed : 'transparent',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }]}>
            <View style={[styles.avatar, { backgroundColor: palette.accent }]}>
              {signedInUser?.profileImage
                ? <Image source={{ uri: signedInUser.profileImage.replace(/^http:\/\//, 'https://') }}
                    style={styles.avatar} accessible={false} />
                : <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.onAccent}
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
                    <Path d={items.Profile.path} /><Circle cx={12} cy={7} r={4} />
                  </Svg>}
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={[styles.label, styles.profileName, { color: palette.text }]}>
                {signedInUser?.nickname || (status === 'signedOut' ? '로그인' : '내 정보')}
              </Text>
              <Text style={[styles.caption, { color: palette.textMuted }]}>내 정보 · 설정</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 240, borderRightWidth: 1 },
  content: { flexGrow: 1, paddingVertical: 24, paddingHorizontal: 16 },
  brand: { minHeight: 44, paddingHorizontal: 16, marginBottom: 28, justifyContent: 'center', borderRadius: 999 },
  logo: { width: 376 / 99 * 22, height: 22 },
  menu: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 16, borderRadius: 999 },
  label: { fontSize: 14, lineHeight: 21, letterSpacing: -0.4, fontFamily: 'Pretendard-Medium' },
  footer: { marginTop: 'auto', paddingTop: 24, gap: 12 },
  profile: { paddingVertical: 8, paddingHorizontal: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, gap: 2 },
  profileName: { fontFamily: 'Pretendard-SemiBold' },
  caption: { fontSize: 12, lineHeight: 18, letterSpacing: -0.4, fontFamily: 'Pretendard-Medium' },
  count: { marginLeft: 'auto', minWidth: 20, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 999,
    fontSize: 11, lineHeight: 13.2, fontFamily: 'Pretendard-SemiBold', textAlign: 'center' },
});
