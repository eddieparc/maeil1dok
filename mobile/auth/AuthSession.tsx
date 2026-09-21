import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import CookieManager from '@react-native-cookies/cookies';
import { clearMobileAuth } from '../authCleanup';
import { buildNativeClientObservationHeaders } from '../clientObservationHeaders';
import { createTokenStore, type TokenPair } from '../api/authTokens';
import { createApiFetch, requestTokenRefresh, type ApiFetch } from '../api/nativeApi';
import { useAppStack } from '../navigation/AppStackContext';
import { getPushInstallationId, readNativePushState } from '../nativePush';
import { createNativePushRuntime, type NativePushRuntime } from '../nativePushLifecycle';
import { csrfHeadersFrom } from '../csrfHeader';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthSessionValue = {
  readonly status: AuthStatus;
  readonly accessToken: string | null;
  readonly apiFetch: ApiFetch;
  readonly pushRuntime: NativePushRuntime;
  readonly signInWithTokens: (access: string, refresh: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

const NATIVE_CLIENT_OBSERVATION_HEADERS = buildNativeClientObservationHeaders({
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  appVersion: Constants.expoConfig?.version,
});

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { stack, betaMode, registerTransition } = useAppStack();
  const tokenStore = useMemo(() => createTokenStore(SecureStore, betaMode === true), [betaMode]);
  const apiUrl = stack.api;
  const webAppUrl = stack.web;
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const applyTokens = useCallback(async (pair: TokenPair | null) => {
    if (pair) {
      await tokenStore.write(pair);
      accessTokenRef.current = pair.access;
      setAccessToken(pair.access);
      setStatus('signedIn');
    } else {
      accessTokenRef.current = null;
      setAccessToken(null);
      setStatus('signedOut');
    }
  }, [tokenStore]);

  const refreshTokens = useCallback(async (): Promise<TokenPair | null> => {
    const stored = await tokenStore.read();
    if (!stored.refresh) return null;
    const { pair } = await requestTokenRefresh(
      apiUrl,
      stored.refresh,
      (url, init) => fetch(url, init),
      NATIVE_CLIENT_OBSERVATION_HEADERS,
    );
    if (pair) {
      await tokenStore.write(pair);
      accessTokenRef.current = pair.access;
      setAccessToken(pair.access);
    }
    return pair;
  }, [apiUrl, tokenStore]);

  // On mount: load the stored pair, then validate by redeeming the refresh
  // token once. A definitive rejection clears the stored pair; a network
  // failure leaves it — the WebView's own restore may still succeed later.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await tokenStore.read();
      if (!stored.refresh) {
        if (!cancelled) {
          accessTokenRef.current = stored.access;
          setAccessToken(stored.access);
          setStatus('signedOut');
        }
        return;
      }
      const { pair, rejected } = await requestTokenRefresh(
        apiUrl,
        stored.refresh,
        (url, init) => fetch(url, init),
        NATIVE_CLIENT_OBSERVATION_HEADERS,
      );
      if (cancelled) return;
      if (pair) {
        await tokenStore.write(pair);
        accessTokenRef.current = pair.access;
        setAccessToken(pair.access);
        setStatus('signedIn');
      } else {
        if (rejected) {
          await tokenStore.clear();
        }
        accessTokenRef.current = null;
        setAccessToken(null);
        setStatus('signedOut');
      }
    })().catch((error) => {
      console.error('[AuthSession] bootstrap failed:', error);
      if (!cancelled) setStatus('signedOut');
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, tokenStore]);

  const apiFetch = useMemo<ApiFetch>(() => createApiFetch({
    baseUrl: apiUrl,
    getAccessToken: () => accessTokenRef.current,
    fetchImpl: (url, init) => fetch(url, init),
    refresh: refreshTokens,
  }), [apiUrl, refreshTokens]);

  const pushRuntime = useMemo(() => createNativePushRuntime({
    apiFetch,
    readState: readNativePushState,
  }), [apiFetch]);

  useEffect(() => {
    if (status === 'signedIn') {
      void pushRuntime.sync().catch((error: unknown) => {
        console.error('[NativePush] Session synchronization failed:', error);
      });
    }
  }, [status, pushRuntime]);

  useEffect(() => registerTransition(async (commit) => {
    if (!accessTokenRef.current) {
      await commit();
      return;
    }
    try {
      await pushRuntime.suspend();
      await commit();
    } catch (error: unknown) {
      await pushRuntime.resume();
      throw error;
    }
  }), [registerTransition, pushRuntime]);

  const signInWithTokens = useCallback(async (access: string, refresh: string) => {
    if (accessTokenRef.current) await pushRuntime.suspend();
    await applyTokens({ access, refresh });
    void pushRuntime.resume().catch((error: unknown) => {
      console.error('[NativePush] Sign-in synchronization failed:', error);
    });
  }, [applyTokens, pushRuntime]);

  const signOut = useCallback(async () => {
    if (accessTokenRef.current) {
      try {
        await pushRuntime.suspend();
        const csrfCookies = await CookieManager.get(apiUrl).catch(() => null);
        const response = await apiFetch('/api/v1/auth/logout/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...NATIVE_CLIENT_OBSERVATION_HEADERS,
            ...csrfHeadersFrom(csrfCookies),
          },
          body: JSON.stringify({ installation_id: await getPushInstallationId() }),
        });
        if (!response.ok) console.error('[AuthSession] Server logout rejected:', response.status);
      } catch (error: unknown) {
        console.error('[AuthSession] Server logout failed:', error);
      }
    }
    // Same cleanup as the WebView logout path: SecureStore tokens plus the
    // shared cookie store, so the WebView session dies with the native one.
    await clearMobileAuth({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      apiUrl,
      cookieNames: tokenStore.cookieNames,
      secureStoreTokenKeys: tokenStore.tokenKeys,
      cookieDomain: (() => {
        try {
          const host = new URL(webAppUrl).hostname;
          return host === 'maeil1dok.app' || host.endsWith('.maeil1dok.app')
            ? '.maeil1dok.app'
            : undefined;
        } catch {
          return undefined;
        }
      })(),
      clearCookieByName: (url, name, useWebKit) =>
        CookieManager.clearByName(url, name, useWebKit),
      setCookie: (url, cookie) => CookieManager.set(url, cookie),
      setCookieFromResponse: (url, cookie) => CookieManager.setFromResponse(url, cookie),
      flushCookies: () => CookieManager.flush(),
      deleteSecureValue: (key) => SecureStore.deleteItemAsync(key),
    }).catch((error) => {
      console.error('[AuthSession] signOut cleanup failed:', error);
    });
    accessTokenRef.current = null;
    setAccessToken(null);
    setStatus('signedOut');
  }, [apiUrl, webAppUrl, apiFetch, pushRuntime, tokenStore]);

  const value = useMemo<AuthSessionValue>(() => ({
    status,
    accessToken,
    apiFetch,
    pushRuntime,
    signInWithTokens,
    signOut,
  }), [status, accessToken, apiFetch, pushRuntime, signInWithTokens, signOut]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuth(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthSessionProvider');
  }
  return value;
}
