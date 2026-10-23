import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStateView } from '../ui/NativeStateView';
import { ProfileSheet } from './ProfileSheet';
import { ProfileAvatar, ProfileButton, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfilePeople({ state, controller, onProfile }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
  readonly onProfile: (id: number) => void;
}) {
  const colors = useProfileColors();
  const people = state.people;
  const result = people?.result;
  return <ProfileSheet visible={people !== null} title={people?.kind === 'following' ? '팔로잉' : '팔로워'} onClose={controller.closePeople}>
    {result?.kind === 'loading' && <NativeStateView kind="loading" message="목록을 불러오고 있어요." />}
    {result?.kind === 'error' && <NativeStateView kind="error" message={result.message} onRetry={() => { if (people) void controller.people(people.kind); }} />}
    {state.actionError && <Text accessibilityRole="alert" style={[profileText.body, { color: colors.error }]}>{state.actionError}</Text>}
    {result?.kind === 'ready' && <View style={styles.list}>
      {result.data.length === 0 && <NativeStateView kind="empty" message="아직 목록이 비어 있어요." />}
      {result.data.map(person => <View key={person.id} style={styles.row}>
        <Pressable testID={`profile-person-${person.id}`} accessibilityRole="button"
          accessibilityLabel={`${person.nickname} 프로필`}
          onPress={() => { controller.closePeople(); onProfile(person.id); }}
          style={({ pressed }) => [styles.name, { backgroundColor: pressed ? colors.hover : 'transparent' }]}>
          <ProfileAvatar uri={person.profile_image} name={person.nickname} size={40} />
          <Text numberOfLines={1} style={[profileText.label, { fontSize: 15, color: colors.text, flex: 1 }]}>{person.nickname}</Text>
        </Pressable>
        {state.viewerId !== null && person.id !== state.viewerId && <ProfileButton small primary={!person.is_following}
          label={person.is_following ? people?.kind === 'following' ? '언팔로우' : '팔로잉' : '팔로우'} disabled={state.refreshing || state.pendingPerson !== null}
          onPress={() => { void controller.follow(person.id); }} />}
      </View>)}
    </View>}
  </ProfileSheet>;
}
const styles = StyleSheet.create({
  list: { minHeight: 200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  name: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16 },
});
