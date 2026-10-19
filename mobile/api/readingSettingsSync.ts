import type { ApiFetch } from './nativeApi';
import {
  DEFAULT_READING_SETTINGS,
  parseReadingSettings,
  parseReadingSettingsResponse,
  parseStoredReadingSettings,
  serializeReadingSettingsPatch,
} from './readingSettings';
import type { ReadingSettings } from './readingSettings';

export interface ReadingSettingsStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ReadingSettingsSession {
  /** Account/session identity AND API stack; never use a rotating access token. */
  readonly key: string;
  /** null means guest; signed-in callers pass the existing useAuth().apiFetch. */
  readonly apiFetch: ApiFetch | null;
}

export interface ReadingSettingsSnapshot {
  readonly sessionKey: string | null;
  readonly settings: ReadingSettings;
  readonly syncError: Error | null;
}

type SettingKey = keyof ReadingSettings;
const keys = Object.keys(DEFAULT_READING_SETTINGS).filter(
  (key): key is SettingKey => key in DEFAULT_READING_SETTINGS,
);
const STORAGE_KEY = 'readingSettings';
const GET_PATH = '/api/v1/auth/reading-settings/';
const PATCH_PATH = '/api/v1/auth/reading-settings/update/';

export class ReadingSettingsSyncError extends Error {
  constructor(readonly operation: 'load' | 'save', readonly status?: number) {
    super(`Reading settings ${operation} failed${status === undefined ? '' : ` (${status})`}`);
    this.name = 'ReadingSettingsSyncError';
  }
}

/** External I/O is injected; update/refresh/retry resolve after their work settles. */
export function createReadingSettingsSync({ storage }: { readonly storage: ReadingSettingsStorage }) {
  let snapshot: ReadingSettingsSnapshot = {
    sessionKey: null, settings: DEFAULT_READING_SETTINGS, syncError: null,
  };
  let session: ReadingSettingsSession | null = null;
  let generation = 0;
  let readSequence = 0;
  let revision = 0;
  let hydrated = false;
  let loadError: Error | null = null;
  let saveError: Error | null = null;
  let saving: Promise<void> | null = null;
  // Retained across sessions so guest re-entry reads after an in-flight guest write.
  let storageTail: Promise<void> = Promise.resolve();
  const versions = new Map<SettingKey, number>();
  const dirty = new Map<SettingKey, number>();
  const listeners = new Set<() => void>();

  const publish = (change: Partial<ReadingSettingsSnapshot>) => {
    snapshot = { ...snapshot, ...change };
    listeners.forEach(listener => listener());
  };
  const fail = (operation: 'load' | 'save', error: unknown) => {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (operation === 'load') loadError = failure;
    else saveError = failure;
    publish({ syncError: loadError ?? saveError });
  };

  const flush = (): Promise<void> => {
    if (saving) return saving;
    const target = session;
    if (!target || (!target.apiFetch && !hydrated) || dirty.size === 0) return Promise.resolve();
    const epoch = generation;
    let failed = false;
    // Schedule on a microtask so the promise is installed before injected I/O runs.
    const work = Promise.resolve().then(async () => {
      while (generation === epoch && dirty.size > 0) {
        const sent = new Map(dirty);
        const settings = snapshot.settings;
        try {
          if (target.apiFetch) {
            const serialized = serializeReadingSettingsPatch(settings);
            const body = Object.fromEntries([...sent.keys()].map(key => {
              const serverKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
              return [serverKey, serialized[serverKey]];
            }));
            const response = await target.apiFetch(PATCH_PATH, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            if (!response.ok) throw new ReadingSettingsSyncError('save', response.status);
            const result: unknown = await response.json();
            if (typeof result !== 'object' || result === null || !('success' in result) || result.success !== true) {
              throw new ReadingSettingsSyncError('save');
            }
          } else {
            const write = storageTail.then(() => storage.setItem(STORAGE_KEY, JSON.stringify(settings)));
            // Keep the ordering barrier fulfilled; the awaited write below reports errors.
            storageTail = write.then(() => undefined, () => undefined);
            await write;
          }
          if (generation !== epoch) return;
          sent.forEach((version, key) => {
            if (dirty.get(key) === version) dirty.delete(key);
          });
          // A PATCH acknowledgment is not a new settings read.
          saveError = null;
          publish({ syncError: loadError });
        } catch (error) {
          failed = true;
          if (generation === epoch) fail('save', error);
          return; // Preserve dirty fields for explicit retry, without a retry loop.
        }
      }
    });
    saving = work.finally(() => {
      if (generation !== epoch) return;
      saving = null;
      // An observer may enqueue an edit between the last ack and this cleanup.
      if (!failed && dirty.size > 0) return flush();
    });
    return saving;
  };

  const refresh = async (): Promise<void> => {
    const target = session;
    if (!target) return;
    const epoch = generation;
    const sequence = ++readSequence;
    const startedVersions = new Map(versions);
    const startedDirty = new Set(dirty.keys());
    // Initial hydration retries must also preserve already acknowledged edits.
    if (!hydrated) versions.forEach((_, key) => startedDirty.add(key));
    try {
      let loaded: ReadingSettings;
      if (target.apiFetch) {
        const response = await target.apiFetch(GET_PATH, { method: 'GET' });
        if (!response.ok) throw new ReadingSettingsSyncError('load', response.status);
        const parsed = parseReadingSettingsResponse(await response.json());
        if (!parsed) throw new ReadingSettingsSyncError('load');
        loaded = parsed;
      } else {
        await storageTail;
        loaded = parseStoredReadingSettings(await storage.getItem(STORAGE_KEY)) ?? DEFAULT_READING_SETTINGS;
      }
      if (generation !== epoch || sequence !== readSequence) return;
      let merged = snapshot.settings;
      for (const key of keys) {
        if (!startedDirty.has(key) && !dirty.has(key) && versions.get(key) === startedVersions.get(key)) {
          merged = { ...merged, [key]: loaded[key] };
        }
      }
      hydrated = true;
      loadError = null;
      publish({ settings: merged, syncError: saveError });
    } catch (error) {
      if (generation === epoch && sequence === readSequence) fail('load', error);
      return;
    }
    await flush();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setSession(next: ReadingSettingsSession | null): Promise<void> {
      if (session?.key === next?.key && session?.apiFetch === next?.apiFetch) return Promise.resolve();
      generation++;
      session = next;
      saving = null;
      hydrated = false;
      loadError = null;
      saveError = null;
      versions.clear();
      dirty.clear();
      publish({ sessionKey: next?.key ?? null, settings: DEFAULT_READING_SETTINGS, syncError: null });
      return refresh();
    },
    update<K extends SettingKey>(key: K, value: ReadingSettings[K]): Promise<void> {
      if (!session) return Promise.resolve();
      const settings = parseReadingSettings({ ...snapshot.settings, [key]: value });
      if (hydrated && settings[key] === snapshot.settings[key]) return Promise.resolve();
      versions.set(key, ++revision);
      dirty.set(key, revision);
      publish({ settings });
      return flush();
    },
    refresh,
    retry: () => loadError ? refresh()
      : dirty.size > 0 && (session?.apiFetch || hydrated) ? flush() : refresh(),
    dispose() {
      generation++;
      session = null;
      saving = null;
      dirty.clear();
      listeners.clear();
    },
  };
}
