import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeButton } from '../ui/NativeButton';
import { NativeStateView } from '../ui/NativeStateView';
import { spacing, typography, useNativeColors } from '../ui/tokens';
import type { ProfileController } from './profileController';
import type { ReadyProfile } from './profileTypes';

export function ProfileAchievements({ state, controller }: {
  readonly state: ReadyProfile; readonly controller: ProfileController;
}) {
  const colors = useNativeColors();
  const result = state.achievements;
  if (!result || result.kind === 'loading') return <NativeStateView kind="loading" message="업적을 불러오고 있어요." />;
  if (result.kind === 'error') return <NativeStateView kind="error" message={result.message} onRetry={() => { void controller.selectTab('achievements', true); }} />;
  const achievements = result.data;
  const bible = achievements.filter(a => !a.achievement_type.includes('hasena'));
  const hasena = achievements.filter(a => a.achievement_type.includes('hasena'));
  const visible = state.achievementTab === 'hasena' ? hasena : bible;
  const categories = [
    { key: 'reading', label: '통독', items: visible.filter(a => !a.achievement_type.includes('streak') && !a.achievement_type.includes('hasena')) },
    { key: 'streak', label: '연속', items: visible.filter(a => a.achievement_type.includes('streak') && !a.achievement_type.includes('hasena')) },
    { key: 'hasena', label: '하세나', items: visible.filter(a => a.achievement_type.includes('hasena')) },
  ];
  return <View style={styles.section}>
    <View style={styles.row}>
      <NativeButton label={`성경통독 ${bible.filter(a => a.unlocked).length}/${bible.length}`}
        selected={state.achievementTab === 'bible'} onPress={() => controller.achievementTab('bible')} />
      <NativeButton label={`하세나 ${hasena.filter(a => a.unlocked).length}/${hasena.length}`}
        selected={state.achievementTab === 'hasena'} onPress={() => controller.achievementTab('hasena')} />
    </View>
    {state.achievementTab === 'bible' && <Text style={[typography.caption, { color: colors.textSecondary }]}>
      전체 플랜 · 플랜별 업적은 아직 제공되지 않아요.
    </Text>}
    {categories.filter(group => group.items.length > 0).map(group => <View key={group.key} style={styles.section}>
      <Text accessibilityRole="header" style={[typography.label, { color: colors.text }]}>
        {group.label} {group.items.filter(a => a.unlocked).length}/{group.items.length}
      </Text>
      <View style={styles.grid}>{group.items.map(a => <View key={a.achievement_type} testID={`achievement-${a.achievement_type}`}
        style={[styles.card, { borderStyle: a.unlocked ? 'solid' : 'dashed',
          borderColor: a.unlocked ? colors.accent : colors.border,
          backgroundColor: a.unlocked ? colors.accentSurface : colors.surface }]}>
        <Ionicons accessible={false} size={24} color={a.unlocked ? colors.accent : colors.textMuted}
          name={a.icon.includes('book') ? 'book-outline'
            : a.icon.includes('calendar') ? 'calendar-outline'
              : /fire|flame/.test(a.icon) ? 'flame-outline'
                : a.icon.includes('star') ? 'star-outline' : 'trophy-outline'} />
        <Text style={[typography.label, { color: colors.text }]}>{a.title}</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{a.description}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {a.unlocked ? `달성${a.unlockedAt ? ` · ${a.unlockedAt.slice(0, 10)}` : ''}`
            : `잠김 · 목표 ${a.milestone_value}${/book|bible/.test(a.achievement_type) ? '권' : '일'}`}
        </Text>
      </View>)}</View>
    </View>)}
    {visible.length === 0 && <NativeStateView kind="empty" message="표시할 업적이 없어요." />}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexBasis: '47%', flexGrow: 1, minWidth: 140, borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
});
