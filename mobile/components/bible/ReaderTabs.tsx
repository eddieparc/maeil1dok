/**
 * ReaderTabs — 성경 리더의 본문 탭 스트립.
 *
 * 각 탭은 저장된 본문 위치(책/장/역본/스크롤)다. 이 컴포넌트는 렌더와
 * 콜백 전달만 한다 — 탭 선택/닫기/추가의 상태 변경과 리더 복원은
 * BibleScreen이 소유한다. WebView 네비게이션은 절대 일어나지 않는다.
 */

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReaderTab } from '../../api/readerTabs';

const BG = '#FAF8F5';
const CARD = '#FFFFFF';
const TEXT = '#1F1A17';
const SECONDARY = '#6B625B';
const TERTIARY = '#9B928A';
const BORDER = '#E9E4DE';
const ACCENT = '#2A1111';
const ACCENT_BG = '#F3EEEE';

interface ReaderTabsProps {
  readonly tabs: readonly ReaderTab[];
  readonly activeTabId: string | null;
  readonly onSelect: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
  readonly onAdd: () => void;
}

export default function ReaderTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onAdd,
}: ReaderTabsProps) {
  const lastTabProtected = tabs.length <= 1;
  return (
    <View style={styles.strip}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <View
              key={tab.id}
              style={[styles.tab, active && styles.tabActive]}
            >
              <TouchableOpacity
                style={styles.tabLabelButton}
                onPress={() => onSelect(tab.id)}
                accessibilityLabel={`탭 ${tab.label}`}
                accessibilityRole="button"
                hitSlop={4}
              >
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
              {!lastTabProtected && (
                <TouchableOpacity
                  style={styles.tabClose}
                  onPress={() => onClose(tab.id)}
                  accessibilityLabel={`탭 닫기 ${tab.label}`}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={active ? '#fff' : TERTIARY}
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAdd}
          accessibilityLabel="새 탭"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="add" size={18} color={SECONDARY} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingLeft: 10,
    paddingRight: 6,
    height: 28,
    maxWidth: 160,
  },
  tabActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  tabLabelButton: {
    flexShrink: 1,
    minWidth: 0,
  },
  tabLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: TEXT,
    letterSpacing: -0.3,
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabClose: {
    marginLeft: 4,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_BG,
  },
});
