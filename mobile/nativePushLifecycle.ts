import type { ApiFetch } from './api/nativeApi';
import type { NativePushState, PushAction } from './nativePush';

export class NativePushOperationError extends Error {}

interface Dependencies {
  readonly readState: (action: PushAction, requestId: string) => Promise<NativePushState>;
  readonly apiFetch: ApiFetch;
}

export function createNativePushRuntime({ readState, apiFetch }: Dependencies) {
  let accepting = true;
  let tail: Promise<unknown> = Promise.resolve();
  let suspension: Promise<void> | null = null;

  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Production may still serve the pre-native-push API during beta rollout.
    if (response.status === 404) return null;
    if (!response.ok) throw new NativePushOperationError('기기 알림 설정을 저장하지 못했습니다.');
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null
      || !('success' in value) || value.success !== true) {
      throw new NativePushOperationError('기기 알림 설정을 확인하지 못했습니다.');
    }
    return value;
  };

  const request = (action: PushAction, requestId: string, automatic = false): Promise<NativePushState> => {
    if (action === 'push:logout') {
      return suspend().then(async () => ({
        ...await readState('push:logout', requestId),
        requestId,
        managed: true,
        subscribed: false,
      }));
    }
    if (!accepting && action !== 'push:identity') {
      return Promise.reject(new NativePushOperationError('계정이나 환경을 전환하고 있습니다.'));
    }
    const operation = tail.then(async () => {
      const ensureCurrent = () => {
        if (!accepting && action !== 'push:identity') {
          throw new NativePushOperationError('계정이나 환경을 전환하고 있습니다.');
        }
      };
      ensureCurrent();
      const state = await readState(action, requestId);
      ensureCurrent();
      if (state.error) throw new NativePushOperationError(state.error);
      const managed = { ...state, requestId, managed: true, subscribed: false };
      if (action === 'push:identity') return managed;
      if (action === 'push:disable' || (automatic && state.permission !== 'granted')) {
        await post('/api/v1/todos/notifications/push/native/remove/', {
          installation_id: state.installationId, opt_out: action === 'push:disable',
        });
        return managed;
      }
      if (!state.token) return managed;
      const identity = { token: state.token, installation_id: state.installationId };
      if (state.permission !== 'granted') return managed;
      if (action === 'push:enable' || automatic) {
        const result = await post('/api/v1/todos/notifications/push/native/', {
          ...identity, platform: state.platform, explicit: !automatic,
        });
        if (!result && action === 'push:enable') {
          throw new NativePushOperationError('현재 환경에서는 기기 알림을 지원하지 않습니다.');
        }
        return { ...managed, subscribed: result !== null && 'enabled' in result && result.enabled === true };
      }
      const result = await post('/api/v1/todos/notifications/push/native/status/', identity);
      return { ...managed, subscribed: result !== null && 'enabled' in result && result.enabled === true };
    });
    // Keep the queue usable after a reported operation failure.
    tail = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const suspend = (): Promise<void> => {
    accepting = false;
    if (!suspension) {
      suspension = (async () => {
        await tail;
        const state = await readState('push:disable', 'push:suspend');
        if (state.error) throw new NativePushOperationError(state.error);
        await post('/api/v1/todos/notifications/push/native/remove/', {
          installation_id: state.installationId, opt_out: false,
        });
      })().catch((error: unknown) => {
        suspension = null;
        throw error;
      });
    }
    return suspension;
  };

  return {
    request,
    sync: () => request('push:status', 'push:changed', true),
    suspend,
    resume: () => {
      accepting = true;
      suspension = null;
      return request('push:status', 'push:changed', true);
    },
  };
}

export type NativePushRuntime = ReturnType<typeof createNativePushRuntime>;
