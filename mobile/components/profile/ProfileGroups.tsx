import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStateView } from '../ui/NativeStateView';
import { ProfileButton, ProfileIcon, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ProfileGroup, ReadyProfile } from './profileTypes';

export function ProfileGroups({ state, controller, onGroups }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
  readonly onGroups: (url: string) => void;
}) {
  const colors = useProfileColors();
  const result = state.groups;
  if (!result || result.kind === 'loading') return <NativeStateView kind="loading" message="그룹을 불러오고 있어요." />;
  if (result.kind === 'error') return <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('groups', true); }} />;
  const hidden = state.isOwnProfile ? result.data.filter(group => !group.show_in_profile) : [];
  // For other profiles the server filters the target membership. Card metadata
  // (role and visibility) belongs to the viewer, not the profile being viewed.
  const shown = result.data.filter(group => !state.isOwnProfile || group.show_in_profile);
  const card = (group: ProfileGroup) => {
    const isHidden = state.isOwnProfile && !group.show_in_profile;
    return <View key={group.id} testID={`profile-group-${group.id}`}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderStyle: isHidden ? 'dashed' : 'solid' }]}>
      <Pressable testID={`profile-group-open-${group.id}`} accessibilityRole="button"
        accessibilityLabel={`${group.name} 그룹 정보`} onPress={() => onGroups(`/groups/${group.id}`)}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: colors.accentSurface }]}>
            <ProfileIcon name="users" color={colors.accent} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]}>{group.name}</Text>
            <Text style={[profileText.small, { fontFamily: 'Pretendard-Regular', color: colors.textSecondary }]}>
              {group.plans.length > 0 ? `${group.plans[0].name}${group.plans.length > 1 ? ` 외 ${group.plans.length - 1}개` : ''}` : '계획 없음'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[profileText.caption, { fontFamily: 'Pretendard-SemiBold', color: colors.textSecondary }]}>
              {isHidden ? '숨김' : group.is_public ? '공개' : '비공개'}
            </Text>
          </View>
        </View>
        {!!group.description && !isHidden && <Text style={[profileText.body, styles.description, { color: colors.textSecondary }]}>{group.description}</Text>}
      </Pressable>
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <View style={styles.members}>
          <ProfileIcon name="users" size={14} color={colors.textMuted} />
          <Text style={[profileText.small, { fontFamily: 'Pretendard-Regular', color: colors.textMuted }]}>{group.member_count}/{group.max_members}명</Text>
        </View>
        <View style={styles.actions}>
          {group.my_role && !isHidden && <View style={[styles.badge, { backgroundColor: colors.accentSurface }]}>
            <Text style={[profileText.caption, { fontFamily: 'Pretendard-SemiBold', color: colors.accent }]}>{group.my_role === '관리자' ? '그룹장' : '멤버'}</Text>
          </View>}
          {state.isOwnProfile && <Pressable testID={`profile-group-visibility-${group.id}`} accessibilityRole="button"
            accessibilityLabel={isHidden ? '프로필에 표시' : '프로필에서 숨기기'} accessibilityState={{ disabled: state.refreshing || state.pendingGroup !== null }}
            disabled={state.refreshing || state.pendingGroup !== null} onPress={() => { void controller.visibility(group.id); }}
            style={[styles.visibility, { borderColor: colors.border, opacity: state.refreshing || state.pendingGroup !== null ? 0.5 : 1 }]}>
            <ProfileIcon name="eye" size={16} color={colors.textSecondary} />
            {isHidden && <Text style={[profileText.small, { color: colors.accent }]}>표시하기</Text>}
          </Pressable>}
        </View>
      </View>
    </View>;
  };
  return <View style={styles.section}>
    {shown.map(card)}
    {hidden.length > 0 && <View style={[styles.hidden, { borderTopColor: colors.border }]}>
      <Pressable testID="profile-hidden-groups" accessibilityRole="button" accessibilityState={{ expanded: state.showHiddenGroups }}
        onPress={controller.hiddenGroups} style={[styles.hiddenToggle, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
        <Text style={[profileText.body, { color: colors.textSecondary, flex: 1 }]}>프로필에 숨겨진 그룹 ({hidden.length})</Text>
        <ProfileIcon name={state.showHiddenGroups ? 'up' : 'down'} size={16} color={colors.textSecondary} />
      </Pressable>
      {state.showHiddenGroups && hidden.map(card)}
    </View>}
    {result.data.length === 0 && <>
      <NativeStateView kind="empty" message="표시할 그룹이 없어요." />
      <ProfileButton testID="profile-groups-browse" label="그룹 둘러보기" primary onPress={() => onGroups('/groups')} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: 20, minHeight: 300, gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Pretendard-Bold', fontSize: 17, lineHeight: 25.5, letterSpacing: -0.4, marginBottom: 4 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  description: { marginBottom: 12 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTopWidth: 1 },
  members: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  visibility: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderWidth: 1, borderRadius: 999 },
  hidden: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderStyle: 'dashed', gap: 12 },
  hiddenToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderRadius: 999 },
});
