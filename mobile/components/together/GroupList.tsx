import { StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNativeColors } from '../ui/tokens';
import type { GroupQuery } from '../../api/togetherData';
import type { TogetherState } from './TogetherModel';
import { GroupCard } from './GroupCard';
import { GroupButton, GroupIconButton } from './GroupControls';

export interface GroupListProps {
  readonly state: TogetherState;
  readonly query: GroupQuery;
  readonly signedIn: boolean;
  readonly onQuery: (query: GroupQuery) => void;
  readonly onOpen: (id: number) => void;
  readonly onRetry: () => void;
  readonly onLogin: () => void;
  readonly onCreate: () => void;
}
export function GroupList({ state, query, signedIn, onQuery, onOpen, onRetry, onLogin, onCreate }: GroupListProps) {
  const colors = useNativeColors();
  const pending = state.listStatus === 'idle' || state.listStatus === 'loading';
  return <View style={styles.content}>
    <View style={styles.searchRow}>
      <View style={[styles.searchContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View pointerEvents="none" style={styles.searchIcon}><Feather name="search" size={18} color={colors.textMuted} accessible={false} /></View>
        <TextInput accessibilityLabel="그룹 이름으로 검색" placeholder="그룹 이름으로 검색"
          placeholderTextColor={colors.textMuted} value={query.search}
          onChangeText={(search) => onQuery({ ...query, search })} returnKeyType="search"
          autoCorrect={false} clearButtonMode="while-editing"
          style={[styles.search, { color: colors.text }]} />
      </View>
      <GroupIconButton label="그룹 생성" icon="plus" size={22} primary onPress={onCreate} />
    </View>
    <View style={styles.filters}>
      {([{ filter: 'all', label: '전체' }, { filter: 'public', label: '공개' }, { filter: 'mine', label: '내 그룹' }] as const).map(({ filter, label }) =>
        <GroupButton key={filter} label={label} variant="chip" selected={query.filter === filter} onPress={() => onQuery({ ...query, filter })} />)}
    </View>
    {pending && !state.groups.length ? <View accessibilityLabel="그룹을 불러오는 중" accessibilityState={{ busy: true }} style={styles.cards}>
      {[0, 1, 2, 3].map((key) => <View key={key} accessible={false} accessibilityElementsHidden
        style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.skeleton, { width: 72, height: 20, backgroundColor: colors.surfaceMuted }]} />
        <View style={[styles.skeleton, { width: '65%', height: 22, backgroundColor: colors.surfaceMuted }]} />
        <View style={[styles.skeleton, { width: '90%', height: 16, backgroundColor: colors.surfaceMuted }]} />
        <View style={[styles.skeleton, { width: '45%', height: 24, backgroundColor: colors.surfaceMuted }]} />
      </View>)}
    </View> : state.listStatus === 'error' ? <View style={styles.error}>
      <Text accessibilityRole="alert" style={[styles.description, { color: colors.textSecondary }]}>{state.listError}</Text>
      <GroupButton label="다시 시도" onPress={onRetry} />
    </View> : state.listStatus === 'guest' ? <View style={styles.empty}>
      <Text style={[styles.description, { color: colors.textSecondary }]}>로그인하면 내 그룹을 볼 수 있어요.</Text>
      <GroupButton label="로그인" onPress={onLogin} />
    </View> : state.groups.length ? <View style={styles.cards} accessibilityState={{ busy: pending }}>
      {state.groups.map((group) => <GroupCard key={group.id} group={group} onPress={() => onOpen(group.id)} />)}
    </View> : <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}><Feather name="users" size={32} color={colors.textMuted} accessible={false} /></View>
      <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.text }]}>{query.search ? '검색 결과가 없습니다' : '아직 그룹이 없습니다'}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{query.search ? '다른 검색어로 시도해보세요.' : '다른 사용자들과 함께 성경을 읽어보세요!'}</Text>
      {signedIn && !query.search && <View style={styles.emptyAction}><GroupButton label="첫 그룹 만들기" variant="primary" onPress={onCreate} /></View>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchContainer: { flex: 1, height: 44, borderWidth: 1, borderRadius: 999, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 15 },
  search: { fontFamily: 'Pretendard-Regular', fontSize: 14, letterSpacing: -0.4, height: 42, paddingLeft: 43, paddingRight: 16, paddingVertical: 0 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cards: { gap: 10 },
  skeletonCard: { padding: 20, borderWidth: 1, borderRadius: 16, gap: 12 },
  skeleton: { borderRadius: 4 },
  error: { alignItems: 'center', padding: 20, gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 250, paddingHorizontal: 20, paddingVertical: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.6, textAlign: 'center', marginBottom: 8 },
  description: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4, textAlign: 'center' },
  emptyAction: { marginTop: 20 },
});
