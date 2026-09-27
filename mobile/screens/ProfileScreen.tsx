import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthSession';
import { localDate, profileTargetId } from '../api/profileData';
import { useAppStack } from '../navigation/AppStackContext';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { createProfileController } from '../components/profile/profileController';
import { ProfileView } from '../components/profile/ProfileView';
import { spacing, typography, useNativeColors } from '../components/ui/tokens';

export default function ProfileScreen({ route }: BottomTabScreenProps<TabParamList, 'Profile'>) {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack, betaMode, setBetaMode } = useAppStack();
  const insets = useSafeAreaInsets();
  const bottomInset = useNativeTabBarInset();
  const colors = useNativeColors();
  const targetId = profileTargetId(route.params?.url);
  // AuthSession has no stable user id. Token/stack replacement must synchronously
  // replace the snapshot, even before the old effect cleanup can run.
  const controller = useMemo(() => createProfileController({
    apiFetch, status, targetId, month: localDate().slice(0, 7),
  }), [apiFetch, status, accessToken, stack.api, targetId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    void controller.start();
    return controller.dispose;
  }, [controller]);
  const share = () => {
    if (state.kind !== 'ready') return;
    const url = `${stack.web}/profile/${state.profile.user.id}`;
    void Share.share({ title: `${state.profile.user.nickname}님의 프로필`, message: url, url })
      .catch(controller.reportError);
  };
  const handleBetaToggle = async (enabled: boolean) => {
    try {
      await setBetaMode(enabled);
    } catch (error: unknown) {
      Alert.alert('베타 전환 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    }
  };
  return <View style={[styles.screen, {
    backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right,
  }]}>
    <Text accessibilityRole="header" style={[typography.title, styles.title, { color: colors.text }]}>
      {targetId === null || (state.kind === 'ready' && state.isOwnProfile) ? '내 정보' : '프로필'}
    </Text>
    <ProfileView state={state} controller={controller} bottomInset={Math.max(bottomInset, insets.bottom)} onShare={share}
      betaMode={betaMode} onBetaModeChange={(enabled) => { void handleBetaToggle(enabled); }}
      onLogin={() => { if (navigationRef.isReady()) navigationRef.navigate('Login'); }}
      onProfile={id => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Profile', params: { url: `${stack.web}/profile/${id}` } }); }}
      onGroups={url => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Together', params: { url: `${stack.web}${url}` } }); }}
      onRead={url => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Bible', params: { url: `${stack.web}${url}` } }); }} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
