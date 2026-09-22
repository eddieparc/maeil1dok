import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_READING_SETTINGS } from '../../api/readingSettings';
import type { ReadingSettings } from '../../api/readingSettings';
import { createReadingSettingsSync } from '../../api/readingSettingsSync';
import type { ReadingSettingsSession, ReadingSettingsStorage } from '../../api/readingSettingsSync';

export interface ReadingSettingsValue {
  readonly settings: ReadingSettings;
  readonly syncError: Error | null;
  readonly update: <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

const ReadingSettingsContext = createContext<ReadingSettingsValue | null>(null);

/**
 * The auth owner supplies a stable account/session + stack key and its apiFetch.
 * Pass null during auth bootstrap, or {key: 'guest:<stack>', apiFetch: null}.
 * This provider does not infer account identity from rotating credentials.
 */
export function ReadingSettingsProvider({
  children, session, storage = AsyncStorage,
}: {
  readonly children: ReactNode;
  readonly session: ReadingSettingsSession | null;
  readonly storage?: ReadingSettingsStorage;
}) {
  const [sync] = useState(() => createReadingSettingsSync({ storage }));
  const snapshot = useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot);
  const key = session?.key;
  const apiFetch = session?.apiFetch;

  useLayoutEffect(() => {
    void sync.setSession(key === undefined ? null : { key, apiFetch: apiFetch ?? null });
    return () => { void sync.setSession(null); };
  }, [sync, key, apiFetch]);

  // Never expose the prior account's snapshot during the render before effects.
  const current = snapshot.sessionKey === (key ?? null);
  const value: ReadingSettingsValue = {
    settings: current ? snapshot.settings : DEFAULT_READING_SETTINGS,
    syncError: current ? snapshot.syncError : null,
    update: sync.update,
    retry: sync.retry,
    refresh: sync.refresh,
  };
  return <ReadingSettingsContext.Provider value={value}>{children}</ReadingSettingsContext.Provider>;
}

export function useReadingSettings(): ReadingSettingsValue {
  const value = useContext(ReadingSettingsContext);
  if (!value) throw new Error('useReadingSettings must be used inside ReadingSettingsProvider');
  return value;
}
