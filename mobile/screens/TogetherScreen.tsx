import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthSession';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { NativeButton } from '../components/ui/NativeButton';
import { NativeStateView } from '../components/ui/NativeStateView';
import { typography, useNativeColors } from '../components/ui/tokens';
import { GroupList } from '../components/together/GroupList';
import { GroupDetail } from '../components/together/GroupDetail';
import { GroupJoinAction } from '../components/together/GroupJoinAction';
import { GroupLifecycle } from '../components/together/GroupLifecycle';
import { TogetherModel } from '../components/together/TogetherModel';
import type { GroupQuery } from '../api/togetherData';

export default function TogetherScreen({ route }: BottomTabScreenProps<TabParamList, 'Together'>) {
  const { apiFetch, status, accessToken } = useAuth();
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const tabInset = useNativeTabBarInset();
  const model = useMemo(() => new TogetherModel(apiFetch, status === 'signedIn'), [apiFetch, status, accessToken]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const [query, setQuery] = useState<GroupQuery>({ search: '', filter: 'all' });
  const onLogin = () => { if (navigationRef.isReady()) navigationRef.navigate('Login'); };

  useEffect(() => {
    model.activate();
    return () => model.dispose();
  }, [model]);
  useEffect(() => {
    if (status !== 'loading') void model.loadList(query);
  }, [model, query, status]);
  useEffect(() => {
    if (status === 'loading' || !route.params?.url) return;
    const url = new URL(route.params.url, 'https://maeil1dok.app');
    const id = /^\/groups\/(\d+)\/?$/.exec(url.pathname)?.[1];
    if (id) void model.openGroup(Number(id));
    else model.closeGroup();
  // New params represent a navigation intent, even when the URL is identical.
  // Focus alone must not replay an old intent over local list/detail state.
  }, [model, route.params, status]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (model.state.createOpen) { model.closeCreate(); return true; }
      if (model.state.leaveConfirm) { model.cancelLeave(); return true; }
      if (model.state.selectedId === null) return false;
      model.closeGroup();
      return true;
    });
    return () => subscription.remove();
  }, [model]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        {state.selectedId !== null && <NativeButton label="뒤로" accessibilityLabel="그룹 목록으로 돌아가기" onPress={() => model.closeGroup()} />}
        <Text accessibilityRole="header" style={[typography.title, styles.title, { color: colors.text }]}>{state.selectedId === null ? '함께' : state.detail?.name || '그룹 정보'}</Text>
        {status !== 'loading' && state.selectedId === null && <NativeButton label="그룹 만들기"
          onPress={() => { if (status === 'signedIn') void model.openCreate(); else onLogin(); }} />}
      </View>
      <ScrollView key={state.selectedId ?? 'list'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: state.detail ? 24 : tabInset + 24 }]}>
        {status === 'loading' ? <NativeStateView kind="loading" message="로그인 상태를 확인하는 중" />
          : state.selectedId === null ? <GroupList state={state} query={query} onQuery={setQuery}
            onOpen={(id) => { void model.openGroup(id); }} onRetry={() => { void model.loadList(query); }} onLogin={onLogin} />
            : state.detailStatus === 'loading' ? <NativeStateView kind="loading" message="그룹을 불러오는 중" />
              : state.detailStatus === 'error' ? <NativeStateView kind="error" message={state.detailError} onRetry={() => { if (state.selectedId !== null) void model.openGroup(state.selectedId); }} />
                : state.detail && <GroupDetail key={state.detail.id} group={state.detail} apiFetch={apiFetch} signedIn={status === 'signedIn'}
                  actionError={state.actionError} />}
      </ScrollView>
      {state.detail && <View style={[styles.footer, { paddingBottom: tabInset + 12, backgroundColor: colors.background }]}>
        <GroupJoinAction group={state.detail} signedIn={status === 'signedIn'} joining={state.joining}
          onJoin={() => { void model.join(); }} onLogin={onLogin} />
        {status === 'signedIn' && state.detail.is_member && state.detail.my_role !== '관리자'
          && <NativeButton label="그룹 탈퇴하기" disabled={state.leaving} onPress={() => model.requestLeave()} />}
      </View>}
      <GroupLifecycle model={model} state={state} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 14, width: '100%', maxWidth: 768, alignSelf: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 12, width: '100%', maxWidth: 768, alignSelf: 'center' },
});
