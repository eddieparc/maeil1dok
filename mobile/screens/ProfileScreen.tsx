import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthSession';
import { localDate, profileTargetId } from '../api/profileData';
import { useAppStack } from '../navigation/AppStackContext';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { createProfileController } from '../components/profile/profileController';
import { ProfileView } from '../components/profile/ProfileView';
import { ProfileIcon, profileText, useProfileColors } from '../components/profile/ProfilePrimitives';

export default function ProfileScreen({ route }: BottomTabScreenProps<TabParamList, 'Profile'>) {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack, betaMode, setBetaMode } = useAppStack();
  const insets = useSafeAreaInsets();
  const bottomInset = useNativeTabBarInset();
  const colors = useProfileColors();
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
  const openSettings = () => {
    if (navigationRef.isReady()) navigationRef.navigate('WebView', { url: `${stack.web}/account/settings` });
  };
  const goBack = () => {
    if (!navigationRef.isReady()) return;
    if (navigationRef.canGoBack()) navigationRef.goBack();
    else navigationRef.navigate('Main', { screen: 'Home' });
  };
  return <View style={[styles.screen, {
    backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right,
  }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable testID="profile-back" accessibilityRole="button" accessibilityLabel="뒤로 가기"
        onPress={goBack} style={({ pressed }) => [styles.headerButton, { backgroundColor: pressed ? colors.hover : 'transparent' }]}>
        <ProfileIcon name="left" size={22} color={colors.textSecondary} />
      </Pressable>
      <Text accessibilityRole="header" style={[profileText.header, styles.title, { color: colors.text }]}>내 정보</Text>
      {state.kind === 'ready' && state.isOwnProfile
        ? <Pressable testID="profile-header-settings" accessibilityRole="button" accessibilityLabel="계정 설정"
          onPress={openSettings} style={({ pressed }) => [styles.headerButton, { backgroundColor: pressed ? colors.hover : 'transparent' }]}>
          <ProfileIcon name="settings" color={colors.textSecondary} />
        </Pressable>
        : <View style={styles.headerButton} />}
    </View>
    <ProfileView state={state} controller={controller} bottomInset={Math.max(bottomInset, insets.bottom)} onShare={share}
      betaMode={betaMode} onBetaModeChange={(enabled) => { void handleBetaToggle(enabled); }}
      onLogin={() => { if (navigationRef.isReady()) navigationRef.navigate('Login'); }}
      onSettings={openSettings}
      onNotificationSettings={() => { if (navigationRef.isReady()) navigationRef.navigate('WebView', { url: `${stack.web}/notifications/settings` }); }}
      onProfile={id => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Profile', params: { url: `${stack.web}/profile/${id}` } }); }}
      onGroups={url => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Together', params: { url: `${stack.web}${url}` } }); }}
      onRead={url => { if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Bible', params: { url: `${stack.web}${url}` } }); }} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  title: { position: 'absolute', left: 68, right: 68, textAlign: 'center' },
});
