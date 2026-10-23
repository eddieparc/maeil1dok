import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthSession';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { useAppStack } from '../navigation/AppStackContext';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import { NativeStateView } from '../components/ui/NativeStateView';
import { useNativeColors } from '../components/ui/tokens';
import { GroupButton, GroupIconButton } from '../components/together/GroupControls';
import { GroupDialog } from '../components/together/GroupDialog';
import { GroupList } from '../components/together/GroupList';
import { GroupDetail } from '../components/together/GroupDetail';
import { GroupDetailError, GroupDetailLoading } from '../components/together/GroupDetailState';
import { GroupJoinAction } from '../components/together/GroupJoinAction';
import { GroupLifecycle } from '../components/together/GroupLifecycle';
import { TogetherModel } from '../components/together/TogetherModel';
import type { GroupQuery } from '../api/togetherData';

export default function TogetherScreen({ route }: BottomTabScreenProps<TabParamList, 'Together'>) {
  const { apiFetch, status, accessToken } = useAuth();
  const { stack } = useAppStack();
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const tabInset = useNativeTabBarInset();
  const lastSelectedId = useRef<number | null>(null);
  const model = useMemo(() => new TogetherModel(apiFetch, status === 'signedIn'), [apiFetch, status, accessToken]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const [query, setQuery] = useState<GroupQuery>({ search: '', filter: 'all' });
  const [detailTab, setDetailTab] = useState<'info' | 'calendar'>('info');
  const [moreGroupId, setMoreGroupId] = useState<number | null>(null);
  const onLogin = () => { if (navigationRef.isReady()) navigationRef.navigate('Login'); };
  const onCreate = () => { if (status === 'signedIn') void model.openCreate(); else onLogin(); };
  const openWebRoute = (path: string) => {
    if (navigationRef.isReady()) navigationRef.navigate('WebView', { url: `${stack.web}${path}` });
  };

  useEffect(() => {
    model.activate();
    if (status !== 'loading' && lastSelectedId.current !== null) void model.openGroup(lastSelectedId.current);
    return () => {
      if (status !== 'loading') lastSelectedId.current = model.state.selectedId;
      model.dispose();
    };
  }, [model]);
  useEffect(() => {
    if (status !== 'loading') void model.loadList(query);
  // Query edits are handled below so typing cannot trigger an immediate read.
  }, [model, status]);
  useEffect(() => {
    if (status === 'loading' || !route.params?.url) return;
    const url = new URL(route.params.url, 'https://maeil1dok.app');
    const id = /^\/groups\/(\d+)\/?$/.exec(url.pathname)?.[1];
    setMoreGroupId(null);
    setDetailTab(url.searchParams.get('tab') === 'calendar' ? 'calendar' : 'info');
    if (id) {
      void model.openGroup(Number(id));
      if (url.searchParams.get('tab') === 'board') openWebRoute(`/groups/${id}?tab=board`);
    }
    else model.closeGroup();
  // New params represent a navigation intent, even when the URL is identical.
  // Focus alone must not replay an old intent over local list/detail state.
  // An auth scope replacement reloads the current local selection above; it
  // must not replay an earlier URL over a group the user selected afterwards.
  }, [route.params, status === 'loading']);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (moreGroupId !== null) { setMoreGroupId(null); return true; }
      if (model.state.createOpen) { model.closeCreate(); return true; }
      if (model.state.leaveConfirm) { model.cancelLeave(); return true; }
      if (model.state.selectedId === null) return false;
      model.closeGroup();
      return true;
    });
    return () => subscription.remove();
  }, [model, moreGroupId]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={[styles.header, state.selectedId !== null && styles.detailHeader]}>
        {state.selectedId !== null && <GroupIconButton label="그룹 목록으로 돌아가기" icon="chevron-left" onPress={() => model.closeGroup()} />}
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, state.selectedId !== null && styles.detailTitle, { color: colors.text }]}>
          {state.selectedId === null ? '함께' : state.detail?.name || '그룹 정보'}
        </Text>
        {state.selectedId === null ? <View style={styles.headerLinks}>
          <GroupButton label="친구" size="sm" onPress={() => openWebRoute('/friends')} />
          <GroupButton label="리더보드" size="sm" onPress={() => openWebRoute('/scoreboard')} />
        </View> : state.detail ? <GroupIconButton label="그룹 더 보기" icon="more-horizontal" onPress={() => setMoreGroupId(state.selectedId)} />
          : <View style={styles.headerPlaceholder} />}
      </View>
      <ScrollView key={state.selectedId ?? 'list'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, state.selectedId !== null && styles.detailContent, { paddingBottom: state.detail ? 24 : tabInset + 20 }]}>
        {status === 'loading' ? <NativeStateView kind="loading" message="로그인 상태를 확인하는 중" />
          : state.selectedId === null ? <GroupList state={state} query={query} signedIn={status === 'signedIn'}
            onQuery={(next) => { setQuery(next); model.changeQuery(next); }} onCreate={onCreate}
            onOpen={(id) => { setDetailTab('info'); void model.openGroup(id); }} onRetry={() => { void model.loadList(query); }} onLogin={onLogin} />
            : state.detailStatus === 'loading' ? <GroupDetailLoading />
              : state.detailStatus === 'error' ? <GroupDetailError message={state.detailError} onBack={() => model.closeGroup()}
                onRetry={() => { if (state.selectedId !== null) void model.openGroup(state.selectedId); }} />
                : state.detail && <GroupDetail key={state.detail.id} group={state.detail} apiFetch={apiFetch} signedIn={status === 'signedIn'}
                  tab={detailTab} onTab={setDetailTab}
                  actionError={state.actionError} onBoard={() => {
                    if (state.detail && navigationRef.isReady()) {
                      navigationRef.navigate('WebView', { url: `${stack.web}/groups/${state.detail.id}?tab=board` });
                    }
                  }} />}
      </ScrollView>
      {state.detail && <View style={[styles.footer, { paddingBottom: tabInset + 12, backgroundColor: colors.background }]}>
        <GroupJoinAction group={state.detail} signedIn={status === 'signedIn'} joining={state.joining}
          onJoin={() => { void model.join(); }} onLogin={onLogin} />
      </View>}
      <GroupDialog visible={state.detail !== null && moreGroupId === state.detail.id} title="그룹 정보" onClose={() => setMoreGroupId(null)}>
        {state.detail && <View style={styles.more}>
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>리더 · {state.detail.creator.nickname}</Text>
          {state.detail.plans.map((plan) => <Text key={plan.id} style={[styles.moreText, { color: colors.textSecondary }]}>{plan.name}</Text>)}
          <GroupButton label="리더보드" onPress={() => { setMoreGroupId(null); openWebRoute('/scoreboard'); }} />
          {status === 'signedIn' && state.detail.is_member && state.detail.my_role !== '관리자'
            && <GroupButton label="그룹 탈퇴하기" variant="danger" disabled={state.leaving}
              onPress={() => { setMoreGroupId(null); model.requestLeave(); }} />}
        </View>}
      </GroupDialog>
      <GroupLifecycle model={model} state={state} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { height: 64, paddingHorizontal: 20, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLinks: { flexDirection: 'row', gap: 6 },
  headerPlaceholder: { width: 44 },
  title: { flex: 1, fontFamily: 'Pretendard-Bold', fontSize: 22, fontWeight: '700', lineHeight: 28.6, letterSpacing: -0.6 },
  detailHeader: { height: 52, paddingVertical: 0 },
  detailTitle: { fontSize: 16, lineHeight: 21, textAlign: 'center', letterSpacing: -0.4 },
  content: { paddingHorizontal: 20, paddingTop: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  detailContent: { paddingTop: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  more: { gap: 12 },
  moreText: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4 },
});
