import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { typography, useNativeColors } from '../ui/tokens';
import type { ReadingGroup } from './contracts';

export function GroupCard({ group, onPress }: { readonly group: ReadingGroup; readonly onPress: () => void }) {
  const colors = useNativeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${group.name}, ${group.member_count}/${group.max_members}명`}
      onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{group.is_public ? '공개' : '비공개'}{group.is_member ? ' · 내 그룹' : ''}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{group.member_count}/{group.max_members}명</Text>
      </View>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{group.name}</Text>
      <Text numberOfLines={2} style={[typography.caption, { color: colors.textSecondary }]}>{group.description || '설명이 없습니다.'}</Text>
      <View style={styles.row}>
        <Text style={[typography.caption, styles.plan, { color: colors.textSecondary }]}>
          {group.plans[0]?.name || '등록된 읽기표 없음'}{group.plans.length > 1 ? ` 외 ${group.plans.length - 1}개` : ''}
        </Text>
        <View style={styles.avatarRow} accessibilityLabel={`${group.creator.nickname} 외 ${Math.max(0, group.member_count - 1)}명`}>
          {group.creator.profile_image
            ? <Image source={{ uri: group.creator.profile_image }} style={styles.avatar} />
            : <Text style={[styles.initial, { backgroundColor: colors.accentSurface, color: colors.accent }]}>{group.creator.nickname.charAt(0) || '?'}</Text>}
          {group.member_count > 1 && <Text style={[typography.caption, { color: colors.textSecondary }]}>+{group.member_count - 1}</Text>}
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 8, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  plan: { flex: 1 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  initial: { width: 28, minHeight: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28 },
});
