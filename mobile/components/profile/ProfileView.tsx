import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStateView } from '../ui/NativeStateView';
import { ProfileAchievements } from './ProfileAchievements';
import { ProfileCalendar } from './ProfileCalendar';
import { ProfileEditor } from './ProfileEditor';
import { ProfileGroups } from './ProfileGroups';
import { ProfilePeople } from './ProfilePeople';
import { ProfileAvatar, ProfileButton, ProfileIcon, ProfileRing, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ProfileState } from './profileTypes';

export function ProfileView({ state, controller, onLogin, onRead, onShare, onProfile, onGroups,
  onSettings, onNotificationSettings, bottomInset, betaMode, onBetaModeChange }: {
  readonly state: ProfileState;
  readonly controller: ProfileController;
  readonly onLogin: () => void;
  readonly onRead: (url: string) => void;
  readonly onShare?: () => void;
  readonly onProfile: (id: number) => void;
  readonly onGroups: (url: string) => void;
  readonly onSettings?: () => void;
  readonly onNotificationSettings?: () => void;
  readonly bottomInset: number;
  readonly betaMode?: boolean | null;
  readonly onBetaModeChange?: (enabled: boolean) => void;
}) {
  const colors = useProfileColors();
  switch (state.kind) {
    case 'loading': return <NativeStateView kind="loading" message="프로필을 불러오고 있어요." />;
    case 'guest': return <View style={styles.guest}>
      <NativeStateView kind="empty" message="로그인하고 통독 기록을 확인해 보세요." />
      <ProfileButton testID="profile-login" label="로그인" onPress={onLogin} primary />
      {onBetaModeChange && <View style={styles.betaRow}>
        <Text style={[profileText.body, { color: colors.text }]}>베타 모드</Text>
        <Switch testID="profile-beta-mode" accessibilityLabel="베타 모드" value={betaMode === true} onValueChange={onBetaModeChange} />
      </View>}
    </View>;
    case 'unauthorized': return <View style={styles.guest}>
      <NativeStateView kind="error" message="로그인이 필요해요." />
      <ProfileButton label="로그인" onPress={onLogin} primary />
    </View>;
    case 'forbidden': return <NativeStateView kind="error" message="이 프로필에 접근할 권한이 없어요." />;
    case 'unavailable': return <NativeStateView kind="empty" message="프로필이 비공개이거나 존재하지 않아요." />;
    case 'error': return <NativeStateView kind="error" message={state.message} onRetry={() => { void controller.start(); }} />;
    case 'ready': break;
  }
  const profile = state.profile;
  // Match frontend/app/stores/profile.ts, including its fixed 365-day baseline.
  const completionRate = Math.round(Math.min(profile.total_completed_days / 365 * 100, 100));
  return <ScrollView testID="profile-scroll" keyboardShouldPersistTaps="handled" style={styles.scroll}
    contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 20, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' }}
    refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { void controller.refresh(); }} tintColor={colors.accent} />}>
    <View style={styles.profile}>
      <View style={styles.user}>
        <ProfileAvatar uri={profile.user.profile_image} name={profile.user.nickname}
          failed={state.avatarFailed} onError={controller.avatarFailed} />
        <View style={styles.info}>
          <Text accessibilityRole="header" style={[profileText.title, styles.name, { color: colors.text }]}>{profile.user.nickname}</Text>
          <Text style={[profileText.body, { color: colors.textSecondary }]}>
            {new Date(profile.joined_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}부터
          </Text>
          {!!profile.bio && <Text style={[profileText.body, styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>}
          <View style={styles.followStats}>
            {([{ kind: 'followers', label: '팔로워', count: profile.followers_count },
              { kind: 'following', label: '팔로잉', count: profile.following_count }] as const).map(item =>
              <Pressable key={item.kind} testID={`profile-${item.kind}`} accessibilityRole="button"
                onPress={() => { void controller.people(item.kind); }} style={styles.textButton}>
                <Text style={[profileText.body, { color: colors.textSecondary }]}>{item.label}{' '}
                  <Text style={[profileText.bold, styles.numeric, { color: colors.text }]}>{item.count}</Text>
                </Text>
              </Pressable>)}
          </View>
        </View>
      </View>
      {profile.is_mutual_follow && <View style={styles.mutual}>
        <ProfileIcon name="mutual" size={16} color={colors.accent} />
        <Text style={[profileText.small, { color: colors.accent }]}>서로 팔로우 중</Text>
      </View>}
      <View style={styles.actions}>
        {state.isOwnProfile && <ProfileButton testID="profile-edit" label="프로필 편집" disabled={state.refreshing} onPress={controller.openEdit} style={styles.action} />}
        {!state.isOwnProfile && state.viewerId !== null && <ProfileButton testID="profile-follow"
          label={profile.is_following ? '팔로잉' : '팔로우'} primary={!profile.is_following}
          disabled={state.refreshing || state.pendingPerson !== null} onPress={() => { void controller.follow(profile.user.id); }} style={styles.action} />}
        {onShare && <ProfileButton testID="profile-share" label="공유" onPress={onShare} style={styles.action} />}
      </View>
      {state.isOwnProfile && <View style={styles.settings}>
        {onSettings && <Pressable testID="profile-settings" accessibilityRole="button" onPress={onSettings} style={styles.textButton}>
          <Text style={[profileText.body, { color: colors.textSecondary }]}>계정 설정</Text>
        </Pressable>}
        {onNotificationSettings && <Pressable testID="profile-notification-settings" accessibilityRole="button"
          onPress={onNotificationSettings} style={styles.textButton}>
          <Text style={[profileText.body, { color: colors.textSecondary }]}>알림 설정</Text>
        </Pressable>}
      </View>}
    </View>
    <View style={[styles.statistics, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ProfileRing value={completionRate}>
        <Text style={[styles.rate, { color: colors.text }]}>{completionRate}<Text style={styles.unit}>%</Text></Text>
        <Text style={[profileText.caption, { color: colors.textSecondary }]}>완료율</Text>
      </ProfileRing>
      <View style={styles.metrics}>
        {[
          { id: 'days', label: '완료한 일수', value: profile.total_completed_days, unit: '일' },
          { id: 'current', label: '현재 연속', value: profile.current_streak, unit: '일' },
          { id: 'longest', label: '최장 연속', value: profile.longest_streak, unit: '일' },
          { id: 'hasena', label: '하세나', value: '-', unit: '회' },
        ].map(item => <View key={item.id} testID={`profile-metric-${item.id}`} style={styles.metric}
          accessible accessibilityLabel={item.id === 'hasena' ? '하세나 기록 제공 안 됨' : `${item.label} ${item.value}${item.unit}`}>
          <Text style={[profileText.caption, styles.metricLabel, { color: colors.textSecondary }]}>{item.label}</Text>
          <View style={styles.metricValue}>
            <Text style={[styles.value, { color: item.id === 'current' ? colors.accent : colors.text }]}>{item.value}</Text>
            <Text style={[styles.unit, { color: item.id === 'current' ? colors.accent : colors.text }]}>{item.unit}</Text>
          </View>
        </View>)}
      </View>
    </View>
    {state.actionError && <Text accessibilityRole="alert" style={[profileText.body, { color: colors.error }]}>{state.actionError}</Text>}
    <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View accessibilityRole="tablist" accessibilityLabel="프로필 정보" style={[styles.tabNav, { borderBottomColor: colors.divider }]}>
        {([
          { id: 'calendar', label: '달력' }, { id: 'achievements', label: '업적' }, { id: 'groups', label: '그룹' },
        ] as const).map(tab => <Pressable key={tab.id} testID={`profile-tab-${tab.id}`} accessibilityRole="tab"
          accessibilityState={{ selected: state.tab === tab.id }} onPress={() => { void controller.selectTab(tab.id); }}
          style={({ pressed }) => [styles.tab, { borderBottomColor: state.tab === tab.id ? colors.accent : 'transparent',
            backgroundColor: pressed ? colors.hover : 'transparent' }]}>
          <Text style={[profileText.label, { fontFamily: state.tab === tab.id ? 'Pretendard-Bold' : 'Pretendard-Medium',
            color: state.tab === tab.id ? colors.text : colors.textSecondary }]}>{tab.label}</Text>
        </Pressable>)}
      </View>
      <View style={styles.tabContent}>
        {state.tab === 'calendar' && <ProfileCalendar state={state} controller={controller} onRead={onRead} />}
        {state.tab === 'achievements' && <ProfileAchievements state={state} controller={controller} />}
        {state.tab === 'groups' && <ProfileGroups state={state} controller={controller} onGroups={onGroups} />}
      </View>
    </View>
    <ProfileEditor state={state} controller={controller} />
    <ProfilePeople state={state} controller={controller} onProfile={onProfile} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  guest: { padding: 24, gap: 16 },
  betaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  profile: { paddingVertical: 4, gap: 12 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  info: { flex: 1, minWidth: 0 },
  name: { marginBottom: 4 },
  bio: { marginTop: 4 },
  followStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  textButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  numeric: { fontVariant: ['tabular-nums'] },
  mutual: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  statistics: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 1, borderRadius: 16 },
  rate: { fontFamily: 'Pretendard-Bold', fontSize: 24, lineHeight: 24, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  metrics: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 18 },
  metric: { flexGrow: 1, flexBasis: '45%', gap: 6 },
  metricLabel: { fontFamily: 'Pretendard-SemiBold' },
  metricValue: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  value: { fontFamily: 'Pretendard-Bold', fontSize: 20, lineHeight: 20, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: 'Pretendard-SemiBold', fontSize: 13 },
  tabs: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tabNav: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 2 },
  tabContent: { minHeight: 280 },
});
