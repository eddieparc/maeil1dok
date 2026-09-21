import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  readonly setBetaMode: (enabled: boolean) => Promise<void>;
  readonly registerTransition: (transition: StackTransition) => () => void;
};

type StackTransition = (commit: () => Promise<void>) => Promise<void>;
const AppStackContext = createContext<AppStackContextValue | null>(null);

export function AppStackProvider({ children }: { children: ReactNode }) {
  const [betaMode, setBetaModeState] = useState<boolean | null>(null);
  const transitionRef = useRef<StackTransition>(commit => commit());
  const registerTransition = useCallback((transition: StackTransition) => {
    transitionRef.current = transition;
    return () => {
      if (transitionRef.current === transition) transitionRef.current = commit => commit();
    };
  }, []);

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

  const setBetaMode = useCallback(async (enabled: boolean) => {
    await transitionRef.current(async () => {
      await SecureStore.setItemAsync(BETA_MODE_STORAGE_KEY, enabled ? '1' : '0');
      setBetaModeState(enabled);
    });
  }, []);

  const value = useMemo<AppStackContextValue>(() => {
    const betaModeEnabled = betaMode === true;
    return {
      ready: betaMode !== null,
      betaMode,
      stack: resolveStack(betaModeEnabled),
      setBetaMode,
      registerTransition,
    };
  }, [betaMode, setBetaMode, registerTransition]);

  return <AppStackContext.Provider value={value}>{children}</AppStackContext.Provider>;
}

export function useAppStack(): AppStackContextValue {
  const value = useContext(AppStackContext);
  if (!value) {
    throw new Error('useAppStack must be used inside AppStackProvider');
  }
  return value;
}
