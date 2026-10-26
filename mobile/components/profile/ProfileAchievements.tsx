import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStateView } from '../ui/NativeStateView';
import { ProfileIcon, profileText, useProfileColors } from './ProfilePrimitives';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfileAchievements({ state, controller }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
}) {
  const colors = useProfileColors();
  const result = state.achievements;
  if (!result || result.kind === 'loading') return <NativeStateView kind="loading" message="업적을 불러오고 있어요." />;
  if (result.kind === 'error') return <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('achievements', true); }} />;
  const achievements = result.data;
  if (achievements.length === 0) return <NativeStateView kind="empty" message="표시할 업적이 없어요." />;
  const bible = achievements.filter(a => !a.achievement_type.includes('hasena'));
  const hasena = achievements.filter(a => a.achievement_type.includes('hasena'));
  const visible = state.achievementTab === 'hasena' ? hasena : bible;
  const plans = state.calendar.kind === 'ready' ? state.calendar.data.plans : [];
  const categories = [
    { key: 'reading', label: '통독', items: visible.filter(a => !a.achievement_type.includes('streak') && !a.achievement_type.includes('hasena')) },
    { key: 'streak', label: '연속', items: visible.filter(a => a.achievement_type.includes('streak') && !a.achievement_type.includes('hasena')) },
    { key: 'hasena', label: '하세나', items: visible.filter(a => a.achievement_type.includes('hasena')) },
  ];
  return <View style={styles.section}>
    <View accessibilityRole="tablist" accessibilityLabel="업적 종류" style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]}>
      {([{ id: 'bible', label: '성경통독', icon: 'book', items: bible },
        { id: 'hasena', label: '하세나', icon: 'flame', items: hasena }] as const).map(tab =>
        <Pressable key={tab.id} testID={`profile-achievement-tab-${tab.id}`} accessibilityRole="tab"
          accessibilityState={{ selected: state.achievementTab === tab.id }}
          onPress={() => controller.achievementTab(tab.id)}
          style={[styles.tab, { backgroundColor: state.achievementTab === tab.id ? colors.card : 'transparent' }]}>
          <ProfileIcon name={tab.icon} size={18} color={state.achievementTab === tab.id ? colors.text : colors.textSecondary} />
          <Text style={[profileText.body, state.achievementTab === tab.id && profileText.bold, { color: colors.text }]}>{tab.label}</Text>
          <Text style={[profileText.caption, { color: colors.textSecondary }]}>{tab.items.filter(a => a.unlocked).length} / {tab.items.length}</Text>
        </Pressable>)}
    </View>
    {state.achievementTab === 'bible' && <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.planTabs} accessibilityRole="tablist" accessibilityLabel="성경통독 플랜">
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.planTab, {
        borderColor: colors.accent, backgroundColor: colors.accentSurface,
      }]}>
        <Text style={[profileText.body, { fontFamily: 'Pretendard-SemiBold', color: colors.accent }]}>전체 플랜</Text>
      </Pressable>
      {plans.map(plan => <Pressable key={plan.id} testID={`profile-achievement-plan-${plan.id}`} accessibilityRole="tab"
        disabled accessibilityState={{ disabled: true, selected: false }} accessibilityHint="플랜별 업적은 아직 제공되지 않아요."
        style={[styles.planTab, { borderColor: colors.border, backgroundColor: colors.card, opacity: 0.5 }]}>
        <Text style={[profileText.body, { fontFamily: 'Pretendard-SemiBold', color: colors.textSecondary }]}>{plan.name}</Text>
      </Pressable>)}
    </ScrollView>}
    {categories.filter(group => group.items.length > 0).map(group => <View key={group.key} style={styles.category}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[profileText.heading, { color: colors.text }]}>{group.label}</Text>
        <Text style={[profileText.small, { color: colors.textSecondary }]}>{group.items.filter(a => a.unlocked).length} / {group.items.length}</Text>
      </View>
      <View style={styles.grid}>{group.items.map(a => {
        const unit = /book|bible/.test(a.achievement_type) ? '권' : '일';
        return <View key={a.achievement_type} testID={`achievement-${a.achievement_type}`}
          accessible accessibilityLabel={`${a.title}, ${a.unlocked ? '달성' : `잠김, 목표 ${a.milestone_value}${unit}`}`}
          style={[styles.card, { borderStyle: a.unlocked ? 'solid' : 'dashed', borderColor: a.unlocked ? colors.accent : colors.border,
            backgroundColor: a.unlocked ? colors.accentSurface : colors.card }]}>
          <View style={[styles.icon, { backgroundColor: a.unlocked ? colors.accent : colors.surfaceMuted }]}>
            <ProfileIcon size={24} color={a.unlocked ? colors.onAccent : colors.textMuted}
              name={a.icon.includes('book') ? 'book' : a.icon.includes('calendar') ? 'calendar'
                : /fire|flame/.test(a.icon) ? 'flame' : a.icon.includes('star') ? 'star'
                  : a.icon.includes('trophy') ? 'trophy' : 'award'} />
          </View>
          <Text style={[profileText.heading, styles.title, { color: colors.text }]}>{a.title}</Text>
          <Text style={[profileText.body, styles.center, { color: colors.textSecondary }]}>{a.description}</Text>
          {a.unlocked ? <Text style={[profileText.small, styles.unlock, { color: colors.accent }]}>
            {a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString('sv-SE').replaceAll('-', '.') : ''}
          </Text> : <View style={styles.locked}>
            <ProfileIcon name="lock" size={18} color={colors.textSecondary} />
            <Text style={[profileText.small, profileText.bold, { color: colors.textSecondary }]}>잠김</Text>
            <Text style={[profileText.small, styles.center, { color: colors.textSecondary }]}>목표 {a.milestone_value}{unit}까지 필요</Text>
            <Text style={[profileText.small, styles.center, { color: colors.textSecondary, fontFamily: 'Pretendard-Regular' }]}>
              {group.key === 'hasena' ? '하세나 기록을 이어가면 잠금이 해제돼요.'
                : group.key === 'streak' ? '연속 통독을 이어가면 잠금이 해제돼요.' : '통독 완료를 쌓으면 잠금이 해제돼요.'}
            </Text>
          </View>}
        </View>;
      })}</View>
    </View>)}
    {visible.length === 0 && <NativeStateView kind="empty" message="표시할 업적이 없어요." />}
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: 20, minHeight: 300, gap: 16 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999 },
  tab: { flex: 1, minWidth: 44, minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 999 },
  planTabs: { gap: 8, padding: 3 },
  planTab: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 999, justifyContent: 'center' },
  category: { gap: 12 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexBasis: '47%', flexGrow: 1, minWidth: 140, borderWidth: 1, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 12, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { textAlign: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  unlock: { marginTop: 12, fontFamily: 'Pretendard-Medium', fontVariant: ['tabular-nums'] },
  locked: { alignItems: 'center', gap: 4, marginTop: 12 },
});
