import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNativeColors } from '../ui/tokens';

export function BibleHomeTips({ bookmarks, notes, highlights }: {
  readonly bookmarks: number; readonly notes: number; readonly highlights: number;
}) {
  const colors = useNativeColors();
  const [dismissed, setDismissed] = useState(true);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem('bible_tips_dismissed').then(value => {
      if (active) setDismissed(value === 'true');
    }).catch((error: unknown) => {
      if (!(error instanceof Error)) throw error;
      if (active) { setDismissed(false); setStorageError(true); }
    });
    return () => { active = false; };
  }, []);
  const tips = [
    { key: 'highlights', title: '하이라이트', description: '본문에서 절을 탭하면 하이라이트·복사·공유 메뉴가 나타나요', count: highlights },
    { key: 'bookmarks', title: '북마크', description: '읽기 화면 더보기 메뉴에서 북마크를 눌러 현재 장을 저장하세요', count: bookmarks },
    { key: 'notes', title: '묵상노트', description: '읽기 화면 더보기 메뉴에서 묵상노트를 작성할 수 있어요', count: notes },
  ].filter(tip => tip.count === 0);
  const title = { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: colors.text };
  return <>
    {!dismissed && bookmarks + notes + highlights < 3 && <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={[title, { color: colors.textSecondary }]}>사용 팁</Text>
        <Pressable testID="bible-dismiss-tips" accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}
          onPress={async () => {
            setDismissed(true);
            try { await AsyncStorage.setItem('bible_tips_dismissed', 'true'); }
            catch (error) { if (!(error instanceof Error)) throw error; setStorageError(true); }
          }}>
          <Text style={{ fontFamily: 'Pretendard-Medium', fontSize: 12, color: colors.textMuted }}>다음부터 표시 안함</Text>
        </Pressable>
      </View>
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        {tips.map((tip, index) => <View key={tip.key}
          style={{ paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: index ? 1 : 0, borderColor: colors.border }}>
          <Text style={title}>{tip.title}</Text>
          <Text style={{ marginTop: 4, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 19.5, color: colors.textSecondary }}>
            {tip.description}
          </Text>
        </View>)}
      </View>
    </View>}
    {storageError && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>
      팁 숨김 설정을 저장하지 못했어요. 다음 방문에는 다시 표시될 수 있어요.
    </Text>}
  </>;
}
