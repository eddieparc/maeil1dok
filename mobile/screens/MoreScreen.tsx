import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef } from '../navigation/navigationRef';
import { useWebViewController } from './WebViewScreen';
import { formatBundleIdentityLabel } from '../bundleIdentity';
import {
  buildMenuItems,
  parseLinkedAccounts,
  parseUser,
  type LinkedAccounts,
  type MoreMenuItem,
  type MoreUser,
} from '../api/moreData';

type LoadState = 'loading' | 'error' | 'ready';

/**
 * 더보기 탭. 프로필 카드 + 웹 화면으로 이어지는 메뉴 목록.
 *
 * 메뉴 행은 전부 WebView 화면을 현재 스택의 경로로 연다 — 네이티브 화면이
 * 생기기 전까지 웹이 단일 원천이다. 베타 토글은 웹의 'beta:set' 브리지와 같은
 * 경로를 탄다: setBetaMode로 플래그를 저장·스택을 바꾼 뒤 WebView를 리마운트해
 * 새 오리진에서 다시 로드한다.
 */
export default function MoreScreen() {
  const { status, apiFetch, signOut } = useAuth();
  const { stack, betaMode, setBetaMode } = useAppStack();
  const { bundleIdentity } = useWebViewController();

  const [user, setUser] = useState<MoreUser | null>(null);
  const [linked, setLinked] = useState<LinkedAccounts | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const userResponse = await apiFetch('/api/v1/auth/user/');
      if (!userResponse.ok) {
        throw new Error(`user fetch failed: ${userResponse.status}`);
      }
      const parsedUser = parseUser(await userResponse.json());
      if (!parsedUser) {
        throw new Error('user payload malformed');
      }
      setUser(parsedUser);

      // 연결 수단은 부가 정보다 — 실패해도 프로필 카드는 그대로 둔다.
      try {
        const linkedResponse = await apiFetch('/api/v1/auth/linked-accounts/');
        if (linkedResponse.ok) {
          setLinked(parseLinkedAccounts(await linkedResponse.json()));
        }
      } catch (error) {
        console.error('[More] linked-accounts fetch failed:', error);
      }
      setLoadState('ready');
    } catch (error) {
      console.error('[More] user fetch failed:', error);
      setLoadState('error');
    }
  }, [apiFetch]);

  useEffect(() => {
    if (status === 'signedIn') {
      void load();
    } else if (status === 'signedOut') {
      setUser(null);
      setLinked(null);
      setLoadState('ready');
    }
  }, [status, load]);

  const openWebPath = useCallback((path: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('WebView', { url: `${stack.web}${path}` });
    }
  }, [stack.web]);

  const handleBetaToggle = useCallback(async (enabled: boolean) => {
    try {
      await setBetaMode(enabled);
    } catch (error: unknown) {
      Alert.alert('베타 전환 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    }
  }, [setBetaMode]);

  const handleLogout = useCallback(() => {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  const menuItems = buildMenuItems({
    betaEnabled: betaMode === true,
  });

  const renderMenuItem = (item: MoreMenuItem, index: number) => {
    if (item.kind === 'beta') {
      return (
        <View key={`beta-${index}`} style={styles.menuRow}>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuDescription}>
              테스트 버전(beta.maeil1dok.app)을 사용합니다
            </Text>
          </View>
          <Switch
            value={item.enabled}
            onValueChange={handleBetaToggle}
            trackColor={{ false: '#d8d4cf', true: '#4B9F7E' }}
            thumbColor="#ffffff"
          />
        </View>
      );
    }
    if (item.kind === 'logout') {
      if (status !== 'signedIn') return null;
      return (
        <TouchableOpacity
          key={`logout-${index}`}
          style={styles.menuRow}
          onPress={handleLogout}
        >
          <Text style={[styles.menuLabel, styles.logoutLabel]}>{item.label}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        key={`link-${item.path}`}
        style={styles.menuRow}
        onPress={() => openWebPath(item.path)}
      >
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderProfile = () => {
    if (status === 'signedOut') {
      return (
        <View style={styles.profileCard}>
          <Text style={styles.loginPromptTitle}>로그인이 필요합니다</Text>
          <Text style={styles.loginPromptMessage}>
            프로필과 계정 설정을 보려면 로그인하세요
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => {
              if (navigationRef.isReady()) navigationRef.navigate('Login');
            }}
          >
            <Text style={styles.loginButtonText}>로그인</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loadState === 'loading' || status === 'loading') {
      return (
        <View style={[styles.profileCard, styles.profileCardCenter]}>
          <ActivityIndicator size="small" color="#4B9F7E" />
        </View>
      );
    }

    if (loadState === 'error') {
      return (
        <View style={[styles.profileCard, styles.profileCardCenter]}>
          <Text style={styles.errorMessage}>프로필을 불러오지 못했습니다</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!user) return null;

    const initial = (user.nickname || user.username).charAt(0);
    const providers = linked?.providers ?? [];
    return (
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.profileTextWrap}>
            <Text style={styles.nickname}>{user.nickname}</Text>
            <Text style={styles.email}>{user.email ?? user.username}</Text>
            {providers.length > 0 && (
              <Text style={styles.providers}>
                연결됨: {providers.join(', ')}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const versionLabel = `v${Constants.expoConfig?.version ?? 'unknown'} · ${formatBundleIdentityLabel(bundleIdentity)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>더보기</Text>
        {renderProfile()}
        <View style={styles.menuCard}>
          {menuItems.map(renderMenuItem)}
        </View>
        <Text style={styles.version}>{versionLabel}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: '#333',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  profileCardCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    backgroundColor: '#4B9F7E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 24,
    color: '#ffffff',
  },
  profileTextWrap: {
    marginLeft: 16,
    flex: 1,
  },
  nickname: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    color: '#333',
  },
  email: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  providers: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  loginPromptTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#333',
  },
  loginPromptMessage: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#4B9F7E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
  errorMessage: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#4B9F7E',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#ffffff',
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  menuTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  menuLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: '#333',
  },
  menuDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  logoutLabel: {
    color: '#d64545',
  },
  chevron: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 20,
    color: '#ccc',
  },
  version: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 20,
  },
});
