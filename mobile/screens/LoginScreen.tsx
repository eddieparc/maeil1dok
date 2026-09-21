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

  return (
    <SafeAreaView style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8f6" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginBox}>
            <TouchableOpacity style={styles.backButton} onPress={hideNativeLogin}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.socialButtons}>
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={6}
                  style={styles.appleButton}
                  onPress={handleAppleLogin}
                />
              )}

              <TouchableOpacity
                style={styles.kakaoButton}
                onPress={handleKakaoLogin}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                <Image
                  source={require('../assets/kakao-icon.png')}
                  style={styles.kakaoIcon}
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
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>구글로 시작하기</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는 이메일로 계속</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, styles.inputTop]}
                placeholder="이메일"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
              <TextInput
                style={[styles.input, styles.inputBottom]}
                placeholder="비밀번호"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isSubmitting}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleEmailLogin}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? '로그인 중...' : '로그인'}
              </Text>
            </TouchableOpacity>

            <View style={styles.authLinks}>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotLink}>비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.registerLink}>이메일로 회원가입</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.bundleIdentityText}>
              {formatBundleIdentityLabel(bundleIdentity)}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Deliberately quiet: this is a diagnostic surface for the OTA reach test, not
  // product copy. It must be readable when asked for and ignorable otherwise.
  bundleIdentityText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginBox: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    gap: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#64748b',
    fontFamily: 'Pretendard-Regular',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    height: 32,
    width: 120,
  },
  socialButtons: {
    gap: 12,
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
  kakaoIcon: {
    width: 18,
    height: 18,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  kakaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    gap: 8,
  },
  kakaoButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#000000',
    letterSpacing: -0.8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  googleButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#1f2937',
    letterSpacing: -0.8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  dividerText: {
    fontFamily: 'Pretendard-Regular',
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#64748b',
    letterSpacing: -0.7,
  },
  inputGroup: {
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    fontFamily: 'Pretendard-Regular',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    letterSpacing: -0.8,
  },
  inputTop: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomWidth: 0,
  },
  inputBottom: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  submitButton: {
    backgroundColor: '#4B9F7E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: 'Pretendard-Medium',
    color: '#fff',
    fontSize: 14,
    letterSpacing: -0.8,
  },
  authLinks: {
    alignItems: 'center',
    gap: 8,
  },
  forgotLink: {
    fontFamily: 'Pretendard-Regular',
    color: '#64748b',
    fontSize: 14,
    letterSpacing: -0.7,
  },
  registerLink: {
    fontFamily: 'Pretendard-Medium',
    color: '#4B9F7E',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    letterSpacing: -0.7,
  },
});
