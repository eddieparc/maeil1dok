import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeButton } from '../ui/NativeButton';
import { NativeSheet } from '../ui/NativeSheet';
import { NativeStateView } from '../ui/NativeStateView';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfilePeople({ state, controller, onProfile }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
  readonly onProfile: (id: number) => void;
}) {
  const colors = useNativeColors();
  const people = state.people;
  const result = people?.result;
  return <NativeSheet visible={people !== null} title={people?.kind === 'following' ? '팔로잉' : '팔로워'} onClose={controller.closePeople}>
    {result?.kind === 'loading' && <NativeStateView kind="loading" message="목록을 불러오고 있어요." />}
    {result?.kind === 'error' && <NativeStateView kind="error" message={result.message} onRetry={() => { if (people) void controller.people(people.kind); }} />}
    {state.actionError && <Text accessibilityRole="alert" style={[typography.body, { color: colors.error }]}>{state.actionError}</Text>}
    {result?.kind === 'ready' && <View style={styles.list}>
      {result.data.length === 0 && <NativeStateView kind="empty" message="아직 목록이 비어 있어요." />}
      {result.data.map(person => <View key={person.id} style={[styles.row, { borderColor: colors.border }]}>
        <Pressable testID={`profile-person-${person.id}`} accessibilityRole="button"
          accessibilityLabel={`${person.nickname} 프로필`}
          onPress={() => { controller.closePeople(); onProfile(person.id); }}
          style={({ pressed }) => [styles.name, { backgroundColor: pressed ? colors.surfacePressed : colors.surface }]}>
          <Text style={[typography.label, { color: colors.text }]}>{person.nickname}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>완료한 일수 {person.total_completed_days}일</Text>
        </Pressable>
        {state.viewerId !== null && person.id !== state.viewerId && <NativeButton
          label={person.is_following ? '언팔로우' : '팔로우'} disabled={state.pendingPerson !== null}
          onPress={() => { void controller.follow(person.id); }} />}
      </View>)}
    </View>}
  </NativeSheet>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  name: { flexGrow: 1, flexShrink: 1, minHeight: 48, justifyContent: 'center', gap: spacing.xs },
});
