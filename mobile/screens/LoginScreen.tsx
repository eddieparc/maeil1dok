import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { buildNativeClientObservationHeaders } from '../clientObservationHeaders';
import { formatNativeAuthError } from '../nativeAuthError';
import { formatBundleIdentityLabel } from '../bundleIdentity';
import type { SocialSignupProvider } from '../socialSignupNavigation';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef, type RootStackParamList } from '../navigation/navigationRef';
import { useWebViewController } from './WebViewScreen';
import { useAuth } from '../auth/AuthSession';

const APP_SCHEME = 'maeil1dok';

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';
const NATIVE_CLIENT_OBSERVATION_HEADERS = buildNativeClientObservationHeaders({
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  appVersion: Constants.expoConfig?.version,
});

const isErrorWithCode = (error: unknown, code: string): boolean => (
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === code
);

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { stack } = useAppStack();
  const controller = useWebViewController();
  const { signInWithTokens } = useAuth();
  const {
    bundleIdentity,
    initiateSessionBridge,
    navigateToPendingUrl,
    navigateToSocialSignup,
    queuePendingUrl,
    hideNativeLogin,
  } = controller;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const WEB_APP_URL = stack.web;
  const API_URL = stack.api;

  // The old shell reset the form every time the login overlay opened.
  useFocusEffect(
    useCallback(() => {
      setEmail('');
      setPassword('');
    }, []),
  );

  // Leave the modal without the history.back injection — a completed login is
  // not a cancelled one.
  const dismissLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  const completeLogin = async (access: string, refresh: string) => {
    const bridgeSuccess = await initiateSessionBridge(access, refresh);
    await signInWithTokens(access, refresh);
    dismissLogin();
    if (bridgeSuccess) {
      navigateToPendingUrl();
    } else {
      // Bridge failed: remount the WebView so it lands on the session cookies
      // (or the login page) fresh, same as the old shell's key bump.
      controller.remountWebView();
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/email-login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...NATIVE_CLIENT_OBSERVATION_HEADERS,
        },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.access) {
        await completeLogin(data.access, data.refresh);
      } else {
        Alert.alert(
          '로그인 실패',
          formatNativeAuthError(data, '이메일 또는 비밀번호를 확인해 주세요.'),
        );
      }
    } catch (error) {
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      const kakaoToken = await kakaoLogin();

      if (kakaoToken.accessToken) {
        setIsSubmitting(true);
        const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...NATIVE_CLIENT_OBSERVATION_HEADERS,
          },
          body: JSON.stringify({
            provider: 'kakao',
            access_token: kakaoToken.accessToken,
            auto_signup: true
          }),
          credentials: 'include',
        });

        const data = await response.json();

        if (data.access) {
          await completeLogin(data.access, data.refresh);
        } else if (data.needsSignup) {
          navigateToSocialSignup('kakao', data);
        } else {
          Alert.alert(
            '로그인 실패',
            formatNativeAuthError(data, '카카오 로그인에 실패했습니다.'),
          );
        }
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
      if (!isErrorWithCode(error, 'E_CANCELLED_OPERATION')) {
        console.error('Kakao login error:', error);
        Alert.alert('오류', '카카오 로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const webRedirectUri = `${WEB_APP_URL}/auth/google/callback`;
      const state = encodeURIComponent(JSON.stringify({ from: 'app', scheme: APP_SCHEME }));
      const appRedirectUri = `${APP_SCHEME}://auth/google/callback`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(webRedirectUri)}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent&state=${state}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const oauthError = url.searchParams.get('error');
        if (oauthError) {
          Alert.alert(
            'Google 로그인 실패',
            formatNativeAuthError(
              {
                error: oauthError,
                error_code: url.searchParams.get('error_code'),
                request_id: url.searchParams.get('request_id'),
              },
              'Google 로그인에 실패했습니다.',
            ),
          );
          return;
        }
        const code = url.searchParams.get('code');

        if (code) {
          await handleSocialLoginCode('google', code, webRedirectUri);
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const requestAppleCredential = () =>
    AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

  const handleAppleLogin = async () => {
    try {
      const credential = await requestAppleCredential();

      if (credential.identityToken) {
        await handleAppleLoginWithToken(credential.identityToken, credential.fullName);
      }
    } catch (error) {
      if (!isErrorWithCode(error, 'ERR_REQUEST_CANCELED')) {
        Alert.alert('오류', 'Apple 로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleAppleLoginWithToken = async (
    identityToken: string,
    fullName: AppleAuthentication.AppleAuthenticationFullName | null
  ) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...NATIVE_CLIENT_OBSERVATION_HEADERS,
        },
        body: JSON.stringify({
          provider: 'apple',
          id_token: identityToken,
          full_name: fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() || undefined : undefined,
          auto_signup: true
        }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('[Apple Login] Response received');

      if (data.access) {
        console.log('[Apple Login] Auth response accepted');
        await completeLogin(data.access, data.refresh);
      } else if (data.needsSignup) {
        console.log('[Apple Login] Needs signup');
        navigateToSocialSignup('apple', data);
      } else {
        console.log('[Apple Login] Login failed:', data.error);
        Alert.alert(
          '로그인 실패',
          formatNativeAuthError(data, 'Apple 로그인에 실패했습니다.'),
        );
      }
    } catch (error) {
      console.error('[Apple Login] Error:', error);
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLoginCode = async (
    provider: SocialSignupProvider,
    code: string,
    redirectUri: string,
  ) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/social-login/v2/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...NATIVE_CLIENT_OBSERVATION_HEADERS,
        },
        body: JSON.stringify({ provider, code, redirect_uri: redirectUri }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.access) {
        await completeLogin(data.access, data.refresh);
      } else if (data.needsSignup) {
        navigateToSocialSignup(provider, data);
      } else {
        Alert.alert(
          '로그인 실패',
          formatNativeAuthError(data, `${provider === 'google' ? 'Google' : provider} 로그인에 실패했습니다.`),
        );
      }
    } catch (error) {
      Alert.alert('오류', '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = () => {
    queuePendingUrl(`${WEB_APP_URL}/register-email`);
    dismissLogin();
    navigateToPendingUrl();
  };

  const handleForgotPassword = () => {
    queuePendingUrl(`${WEB_APP_URL}/auth/forgot-password`);
    dismissLogin();
    navigateToPendingUrl();
  };

  const handleLegalLink = (path: string) => {
    queuePendingUrl(`${WEB_APP_URL}${path}`);
    dismissLogin();
    navigateToPendingUrl();
  };

  const isSubmitDisabled = isSubmitting || !email.trim() || !password;

  return (
    <SafeAreaView style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginBox}>
            <View style={styles.appbar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={hideNativeLogin}
                accessibilityLabel="뒤로가기"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={22} color="#1F1A17" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.tagline}>매일 말씀과 함께, 기록은 여기에</Text>
              </View>

              <View style={styles.socialButtons}>
                <TouchableOpacity
                  style={styles.kakaoButton}
                  onPress={handleKakaoLogin}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Image
                    source={require('../assets/kakao-icon.png')}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Image
                    source={require('../assets/google-icon.png')}
                    style={styles.socialIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>구글로 시작하기</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.appleButton}
                    onPress={handleAppleLogin}
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                    <Text style={styles.appleButtonText}>Apple로 시작하기</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는 이메일로</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="이메일 또는 아이디"
                  placeholderTextColor="#9B928A"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호"
                  placeholderTextColor="#9B928A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
                onPress={handleEmailLogin}
                activeOpacity={0.8}
                disabled={isSubmitDisabled}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? '로그인 중...' : '로그인'}
                </Text>
              </TouchableOpacity>

              <View style={styles.authLinks}>
                <TouchableOpacity onPress={handleForgotPassword} style={styles.authLink}>
                  <Text style={styles.forgotLink}>비밀번호 찾기</Text>
                </TouchableOpacity>
                <Text style={styles.linkSeparator}>|</Text>
                <TouchableOpacity onPress={handleRegister} style={styles.authLink}>
                  <Text style={styles.registerLink}>이메일로 회원가입</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.legalLinks}>
                <TouchableOpacity onPress={() => handleLegalLink('/terms')}>
                  <Text style={styles.legalLink}>이용약관</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}>·</Text>
                <TouchableOpacity onPress={() => handleLegalLink('/privacy')}>
                  <Text style={styles.legalLink}>개인정보처리방침</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}>·</Text>
                <TouchableOpacity onPress={() => handleLegalLink('/company')}>
                  <Text style={styles.legalLink}>사업자 정보</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.bundleIdentityText}>
                {formatBundleIdentityLabel(bundleIdentity)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loginBox: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  appbar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  content: {
    flex: 1,
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 44,
  },
  logo: {
    height: 22,
    width: 84,
  },
  tagline: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#6B625B',
    letterSpacing: -0.4,
  },
  socialButtons: {
    gap: 10,
  },
  socialIcon: {
    width: 18,
    height: 18,
  },
  kakaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: '#FEE500',
    gap: 8,
  },
  kakaoButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#191600',
    letterSpacing: -0.4,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E4DE',
    gap: 8,
  },
  googleButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#1F1A17',
    letterSpacing: -0.4,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: '#1F1A17',
    gap: 8,
  },
  appleButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E9E4DE',
  },
  dividerText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#9B928A',
    letterSpacing: -0.4,
  },
  inputGroup: {
    gap: 10,
  },
  input: {
    fontFamily: 'Pretendard-Medium',
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F1A17',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E4DE',
    borderRadius: 14,
    letterSpacing: -0.4,
  },
  submitButton: {
    height: 52,
    marginTop: 6,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1111',
    shadowColor: '#14100C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: -0.4,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  authLink: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotLink: {
    fontFamily: 'Pretendard-Medium',
    color: '#6B625B',
    fontSize: 13,
    letterSpacing: -0.4,
  },
  registerLink: {
    fontFamily: 'Pretendard-Medium',
    color: '#2A1111',
    fontSize: 13,
    letterSpacing: -0.4,
  },
  linkSeparator: {
    color: '#E9E4DE',
    fontSize: 13,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 24,
  },
  legalLink: {
    fontFamily: 'Pretendard-Regular',
    color: '#9B928A',
    fontSize: 11,
    letterSpacing: -0.4,
  },
  legalSeparator: {
    color: '#9B928A',
    fontSize: 11,
  },
  // Deliberately quiet: this is a diagnostic surface for the OTA reach test, not
  // product copy. It must be readable when asked for and ignorable otherwise.
  bundleIdentityText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#9B928A',
  },
});
