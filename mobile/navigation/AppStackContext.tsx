import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  BETA_MODE_STORAGE_KEY,
  parseBetaModeFlag,
  resolveStack,
  type BetaStack,
} from '../betaMode';

/**
 * Which stack (prod or beta) the shell is bound to. The WebView screen reads
 * `stack` for its origin and apiFetch uses `stack.api` as its base URL.
 *
 * `betaMode` is null while the SecureStore read is in flight — the loading
 * gate holds on `ready` so the WebView never mounts on the wrong stack.
 */
export type AppStackContextValue = {
  readonly ready: boolean;
  readonly betaMode: boolean | null;
  readonly stack: BetaStack;
  readonly setBetaMode: (enabled: boolean) => void;
};

const AppStackContext = createContext<AppStackContextValue | null>(null);

export function AppStackProvider({ children }: { children: ReactNode }) {
  const [betaMode, setBetaModeState] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(BETA_MODE_STORAGE_KEY)
      .then((value) => {
        setBetaModeState(parseBetaModeFlag(value));
      })
      .catch((error) => {
        // A failed read must not strand the app on the loading screen; prod is
        // the safe default.
        console.error('[BetaMode] SecureStore read failed:', error);
        setBetaModeState(false);
      });
  }, []);

  const value = useMemo<AppStackContextValue>(() => {
    const betaModeEnabled = betaMode === true;
    return {
      ready: betaMode !== null,
      betaMode,
      stack: resolveStack(betaModeEnabled),
      setBetaMode: (enabled: boolean) => {
        // Persist first so a crash mid-switch still lands on the requested
        // stack next launch, then swap the stack for this session.
        void SecureStore.setItemAsync(BETA_MODE_STORAGE_KEY, enabled ? '1' : '0')
          .catch((error) => console.error('[BetaMode] SecureStore write failed:', error));
        setBetaModeState(enabled);
      },
    };
  }, [betaMode]);

  return <AppStackContext.Provider value={value}>{children}</AppStackContext.Provider>;
}

export function useAppStack(): AppStackContextValue {
  const value = useContext(AppStackContext);
  if (!value) {
    throw new Error('useAppStack must be used inside AppStackProvider');
  }
  return value;
}
