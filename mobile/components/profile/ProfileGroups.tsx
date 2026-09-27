import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeButton } from '../ui/NativeButton';
import { NativeStateView } from '../ui/NativeStateView';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import type { ProfileController } from './profileController';
import type { ProfileGroup, ReadyProfile } from './profileTypes';

function GroupInfo({ group }: { readonly group: ProfileGroup }) {
  const colors = useNativeColors();
  return <View style={styles.section}>
    <Text style={[typography.label, { color: colors.text }]}>{group.name}</Text>
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{group.is_public ? '공개' : '비공개'} · {group.my_role === '관리자' ? '그룹장' : '멤버'}</Text>
    {!!group.description && <Text style={[typography.body, { color: colors.text }]}>{group.description}</Text>}
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{group.member_count}/{group.max_members}명</Text>
    <Text style={[typography.body, { color: colors.textSecondary }]}>{group.plans.map(plan => plan.name).join(' · ') || '계획 없음'}</Text>
  </View>;
}
export function ProfileGroups({ state, controller, onGroups }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
  readonly onGroups: (url: string) => void;
}) {
  const colors = useNativeColors();
  const result = state.groups;
  if (!result || result.kind === 'loading') return <NativeStateView kind="loading" message="그룹을 불러오고 있어요." />;
  if (result.kind === 'error') return <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('groups', true); }} />;
  const hidden = state.isOwnProfile ? result.data.filter(group => !group.show_in_profile) : [];
  // On another profile the endpoint already filters by the target membership.
  // show_in_profile in its card describes the viewer's membership, not the target's.
  const shown = result.data.filter(group => !state.isOwnProfile || group.show_in_profile);
  const card = (group: ProfileGroup) => <View key={group.id} testID={`profile-group-${group.id}`}
    style={[styles.card, { borderColor: colors.border, borderStyle: group.show_in_profile ? 'solid' : 'dashed' }]}>
    <Pressable testID={`profile-group-open-${group.id}`} accessibilityRole="button"
      accessibilityLabel={`${group.name} 그룹 정보`} onPress={() => onGroups(`/groups/${group.id}`)}
      style={({ pressed }) => ({ minHeight: 48, backgroundColor: pressed ? colors.surfacePressed : colors.surface })}>
      <GroupInfo group={group} />
    </Pressable>
    <View style={styles.row}>
      {state.isOwnProfile && <NativeButton label={group.show_in_profile ? '프로필에서 숨기기' : '프로필에 표시'}
        disabled={state.pendingGroup !== null} onPress={() => { void controller.visibility(group.id); }} />}
    </View>
  </View>;
  return <View style={styles.section}>
    {shown.map(card)}
    {result.data.length === 0 && <>
      <NativeStateView kind="empty" message="표시할 그룹이 없어요." />
      <View testID="profile-groups-browse"><NativeButton label="그룹 둘러보기" onPress={() => onGroups('/groups')} /></View>
    </>}
    {hidden.length > 0 && <>
      <NativeButton label={`숨겨진 그룹 ${hidden.length}개`} selected={state.showHiddenGroups} onPress={controller.hiddenGroups} />
      {state.showHiddenGroups && hidden.map(card)}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: spacing.lg },
});
