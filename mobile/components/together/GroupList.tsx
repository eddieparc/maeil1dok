import { StyleSheet, TextInput, View } from 'react-native';
import { NativeButton } from '../ui/NativeButton';
import { NativeStateView } from '../ui/NativeStateView';
import { typography, useNativeColors } from '../ui/tokens';
import type { GroupQuery } from '../../api/togetherData';
import type { TogetherState } from './TogetherModel';
import { GroupCard } from './GroupCard';

export interface GroupListProps {
  readonly state: TogetherState;
  readonly query: GroupQuery;
  readonly onQuery: (query: GroupQuery) => void;
  readonly onOpen: (id: number) => void;
  readonly onRetry: () => void;
  readonly onLogin: () => void;
}
export function GroupList({ state, query, onQuery, onOpen, onRetry, onLogin }: GroupListProps) {
  const colors = useNativeColors();
  return (
    <View style={styles.content}>
      <TextInput accessibilityLabel="그룹 이름으로 검색" placeholder="그룹 이름으로 검색"
        placeholderTextColor={colors.textMuted} value={query.search}
        onChangeText={(search) => onQuery({ ...query, search })} returnKeyType="search"
        autoCorrect={false} clearButtonMode="while-editing"
        style={[typography.body, styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      <View style={styles.filters}>
        {([{ filter: 'all', label: '전체' }, { filter: 'public', label: '공개' }, { filter: 'mine', label: '내 그룹' }] as const).map(({ filter, label }) =>
          <NativeButton key={filter} label={label} selected={query.filter === filter} onPress={() => onQuery({ ...query, filter })} />)}
      </View>
      {(state.listStatus === 'idle' || state.listStatus === 'loading') && <NativeStateView kind="loading" message="그룹을 불러오는 중" />}
      {state.listStatus === 'error' && <NativeStateView kind="error" message={state.listError} onRetry={onRetry} />}
      {state.listStatus === 'guest' && <View><NativeStateView kind="empty" message="로그인하면 내 그룹을 볼 수 있어요." /><NativeButton label="로그인" onPress={onLogin} /></View>}
      {state.listStatus === 'ready' && (state.groups.length
        ? state.groups.map((group) => <GroupCard key={group.id} group={group} onPress={() => onOpen(group.id)} />)
        : <NativeStateView kind="empty" message={query.search ? '검색 결과가 없습니다. 다른 검색어로 시도해 보세요.' : '아직 그룹이 없습니다.'} />)}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 14 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
