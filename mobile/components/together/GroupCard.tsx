import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors as palettes, useNativeColors } from '../ui/tokens';
import type { ReadingGroup } from './contracts';
import { GroupBadges } from './GroupControls';

export function GroupCard({ group, onPress }: { readonly group: ReadingGroup; readonly onPress: () => void }) {
  const colors = useNativeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${group.name}, ${group.member_count}/${group.max_members}명`}
      onPress={onPress} style={({ pressed }) => [styles.card, {
        backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border,
        shadowOpacity: colors.text === palettes.dark.text ? 0 : 0.04,
      }]}>
      <View style={styles.row}>
        <GroupBadges isPublic={group.is_public} membership={group.is_member ? '내 그룹' : undefined} />
        <Text style={[styles.meta, { color: colors.textMuted }]}>{group.member_count}/{group.max_members}명</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{group.name}</Text>
      <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary }]}>{group.description || '설명이 없습니다.'}</Text>
      <View style={[styles.row, styles.footer]}>
        <Text numberOfLines={1} style={[styles.meta, styles.plan, { color: colors.textSecondary }]}>
          {group.plans[0]?.name || '등록된 읽기표 없음'}{group.plans.length > 1 ? ` 외 ${group.plans.length - 1}개` : ''}
        </Text>
        <View style={styles.avatarRow} accessibilityLabel={`${group.creator.nickname} 외 ${Math.max(0, group.member_count - 1)}명`}>
          {group.creator.profile_image
            ? <Image source={{ uri: group.creator.profile_image }} style={[styles.avatar, { borderColor: colors.surface }]} />
            : <View style={[styles.avatar, { borderColor: colors.surface, backgroundColor: colors.accentSurface }]}>
              <Text style={[styles.initial, { color: colors.accent }]}>{group.creator.nickname.charAt(0) || '?'}</Text>
            </View>}
          {group.member_count > 1 && <View style={[styles.avatar, styles.count, { borderColor: colors.surface, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>+{group.member_count - 1}</Text>
          </View>}
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { paddingHorizontal: 20, paddingVertical: 18, borderRadius: 20, borderWidth: 1, gap: 8,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  plan: { flex: 1 },
  title: { fontFamily: 'Pretendard-Bold', fontSize: 17, fontWeight: '700', lineHeight: 22.1, letterSpacing: -0.4, marginTop: 2 },
  description: { fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 19.5, letterSpacing: -0.4 },
  meta: { fontFamily: 'Pretendard-Regular', fontSize: 12, lineHeight: 18, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  footer: { marginTop: 4 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'Pretendard-Bold', fontSize: 10, fontWeight: '700', letterSpacing: -0.4 },
  count: { width: 'auto', minWidth: 24, paddingHorizontal: 3 },
  countText: { fontFamily: 'Pretendard-Bold', fontSize: 9, fontWeight: '700', letterSpacing: -0.4 },
});
