import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { NativeButton } from '../ui/NativeButton';
import { NativeStateView } from '../ui/NativeStateView';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import { ProfileAchievements } from './ProfileAchievements';
import { ProfileCalendar } from './ProfileCalendar';
import { ProfileEditor } from './ProfileEditor';
import { ProfileGroups } from './ProfileGroups';
import { ProfilePeople } from './ProfilePeople';
import type { ProfileController } from './profileController';
import type { ProfileState } from './profileTypes';

export function ProfileView({ state, controller, onLogin, onRead, onShare, onProfile, onGroups, bottomInset }: {
  readonly state: ProfileState;
  readonly controller: ProfileController;
  readonly onLogin: () => void;
  readonly onRead: (url: string) => void;
  readonly onShare?: () => void;
  readonly onProfile: (id: number) => void;
  readonly onGroups: (url: string) => void;
  readonly bottomInset: number;
}) {
  const colors = useNativeColors();
  switch (state.kind) {
    case 'loading': return <NativeStateView kind="loading" message="프로필을 불러오고 있어요." />;
    case 'guest': return <View style={styles.guest}>
      <NativeStateView kind="empty" message="로그인하고 통독 기록을 확인해 보세요." />
      <View testID="profile-login"><NativeButton label="로그인" onPress={onLogin} /></View>
    </View>;
    case 'unauthorized': return <View style={styles.guest}>
      <NativeStateView kind="error" message="로그인이 필요해요." />
      <NativeButton label="로그인" onPress={onLogin} />
    </View>;
    case 'forbidden': return <NativeStateView kind="error" message="이 프로필에 접근할 권한이 없어요." />;
    case 'unavailable': return <NativeStateView kind="empty" message="프로필이 비공개이거나 존재하지 않아요." />;
    case 'error': return <NativeStateView kind="error" message={state.message} onRetry={() => { void controller.start(); }} />;
    case 'ready': break;
  }
  const profile = state.profile;
  // Beta's displayed completion rate is explicitly a 365-day reference, not a
  // per-plan percentage. Keep that denominator visible to avoid a false metric.
  const rate = Math.round(Math.min(profile.total_completed_days / 365 * 100, 100));
  const circumference = 2 * Math.PI * 42;
  return <ScrollView testID="profile-scroll" keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomInset + spacing.xl, gap: spacing.lg }}
    refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void controller.start(); }} tintColor={colors.accent} />}>
    <View style={styles.profile}>
      <View style={styles.row}>
        {profile.user.profile_image && !state.avatarFailed
          ? <Image accessibilityLabel={`${profile.user.nickname} 프로필 이미지`} source={{ uri: profile.user.profile_image }}
              onError={controller.avatarFailed} style={styles.avatar} />
          : <View style={[styles.avatar, { backgroundColor: colors.accentSurface }]}>
              <Text accessibilityLabel="기본 프로필 이미지" style={[typography.title, { color: colors.accent }]}>{profile.user.nickname.slice(0, 1)}</Text>
            </View>}
        <View style={styles.info}>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{profile.user.nickname}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {new Date(profile.joined_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}부터
          </Text>
          {!!profile.bio && <Text style={[typography.body, { color: colors.text }]}>{profile.bio}</Text>}
        </View>
      </View>
      <View style={styles.row}>
        <NativeButton label={`팔로워 ${profile.followers_count}`} onPress={() => { void controller.people('followers'); }} />
        <NativeButton label={`팔로잉 ${profile.following_count}`} onPress={() => { void controller.people('following'); }} />
      </View>
      <View style={styles.row}>
        {state.isOwnProfile && <Pressable testID="profile-edit" accessibilityRole="button" accessibilityLabel="프로필 편집"
          onPress={controller.openEdit} style={({ pressed }) => [styles.edit, {
            borderColor: colors.border, backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          }]}>
          <Text style={[typography.label, { color: colors.text }]}>프로필 편집</Text>
        </Pressable>}
        {!state.isOwnProfile && state.viewerId !== null && <NativeButton
          label={profile.is_following ? '언팔로우' : '팔로우'} disabled={state.pendingPerson !== null}
          onPress={() => { void controller.follow(profile.user.id); }} />}
        {onShare && <NativeButton label="공유" onPress={onShare} />}
      </View>
    </View>
    <View style={[styles.statistics, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View accessible accessibilityLabel={`완료율 ${rate}퍼센트, 365일 기준`} style={styles.ring}>
        <Svg width={96} height={96} viewBox="0 0 96 96" accessible={false}>
          <Circle cx={48} cy={48} r={42} fill="none" stroke={colors.surfaceMuted} strokeWidth={8} />
          <Circle cx={48} cy={48} r={42} fill="none" stroke={colors.accent} strokeWidth={8}
            strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - rate / 100)}
            rotation={-90} origin="48, 48" strokeLinecap="round" />
        </Svg>
        <Text style={[typography.label, styles.rate, { color: colors.text }]}>{rate}%</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>완료율 · 365일 기준</Text>
      </View>
      <View style={styles.metrics}>
        {[
          ['완료한 일수', `${profile.total_completed_days}일`],
          ['현재 연속', `${profile.current_streak}일`],
          ['최장 연속', `${profile.longest_streak}일`],
          ['하세나', '제공 안 됨'],
        ].map(([label, value]) => <View key={label} style={styles.metric}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[typography.label, { color: colors.text }]}>{value}</Text>
        </View>)}
      </View>
    </View>
    <View accessibilityRole="tablist" style={styles.row}>
      {([
        { id: 'calendar', label: '달력' }, { id: 'achievements', label: '업적' }, { id: 'groups', label: '그룹' },
      ] as const).map(tab => <Pressable key={tab.id} accessibilityRole="tab"
        accessibilityState={{ selected: state.tab === tab.id }}
        onPress={() => { void controller.selectTab(tab.id); }}
        style={({ pressed }) => [styles.tab, { borderColor: state.tab === tab.id ? colors.accent : colors.border,
          backgroundColor: pressed ? colors.surfacePressed : state.tab === tab.id ? colors.accentSurface : colors.surface }]}>
        <Text style={[typography.label, { color: colors.text }]}>{tab.label}</Text>
      </Pressable>)}
    </View>
    {state.actionError && <Text accessibilityRole="alert" style={[typography.body, { color: colors.error }]}>{state.actionError}</Text>}
    {state.tab === 'calendar' && <ProfileCalendar state={state} controller={controller} onRead={onRead} />}
    {state.tab === 'achievements' && <ProfileAchievements state={state} controller={controller} />}
    {state.tab === 'groups' && <ProfileGroups state={state} controller={controller} onGroups={onGroups} />}
    <ProfileEditor state={state} controller={controller} />
    <ProfilePeople state={state} controller={controller} onProfile={onProfile} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  guest: { padding: spacing.xl, gap: spacing.lg },
  profile: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.xs },
  edit: { minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 1, borderRadius: 12 },
  statistics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderWidth: 1, borderRadius: 16 },
  ring: { alignItems: 'center', gap: spacing.sm },
  rate: { position: 'absolute', top: 36 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', flexGrow: 1, flexBasis: 170, gap: spacing.md },
  metric: { minWidth: 72, flexBasis: '43%', gap: spacing.xs },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderBottomWidth: 2, borderRadius: 10 },
});
