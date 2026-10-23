import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNativeColors } from '../ui/tokens';
import { GroupButton } from './GroupControls';

export function GroupDetailLoading() {
  const colors = useNativeColors();
  const line = { backgroundColor: colors.surfaceMuted, borderRadius: 4 };
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  return <View accessibilityLabel="그룹을 불러오는 중" accessibilityState={{ busy: true }} style={styles.loading}>
    <View accessible={false} accessibilityElementsHidden style={card}>
      <View style={[line, { width: 80, height: 20 }]} />
      <View style={[line, { width: '65%', height: 28 }]} />
      <View style={[line, { height: 60 }]} />
    </View>
    <View accessible={false} accessibilityElementsHidden style={[line, { width: 240, height: 44 }]} />
    <View accessible={false} accessibilityElementsHidden style={card}>
      {[0, 1, 2, 3].map((key) => <View key={key} style={[line, { height: 56 }]} />)}
    </View>
  </View>;
}

export function GroupDetailError({ message, onRetry, onBack }: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly onBack: () => void;
}) {
  const colors = useNativeColors();
  return <View style={[styles.card, styles.error, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Feather name="alert-circle" size={48} color={colors.error} accessible={false} />
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>그룹을 불러올 수 없습니다</Text>
    <Text accessibilityRole="alert" style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    <GroupButton label="다시 시도" onPress={onRetry} />
    <GroupButton label="그룹 목록으로 돌아가기" onPress={onBack} />
  </View>;
}
const styles = StyleSheet.create({
  loading: { gap: 14 }, card: { padding: 20, borderWidth: 1, borderRadius: 16, gap: 12 },
  error: { alignItems: 'center' },
  title: { fontFamily: 'Pretendard-Bold', fontWeight: '700', fontSize: 18, lineHeight: 24, letterSpacing: -0.6, textAlign: 'center' },
  message: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, letterSpacing: -0.4, textAlign: 'center' },
});
