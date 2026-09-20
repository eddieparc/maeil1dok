import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const INSTALLATION_KEY = 'maeil1dok_push_installation';
const TOKEN_KEY = 'maeil1dok_push_token';
let installationPromise: Promise<string> | null = null;
let lastToken: string | null = null;

export type PushAction = 'push:status' | 'push:enable' | 'push:disable';
export interface NativePushState {
  readonly requestId: string;
  readonly permission: 'granted' | 'denied' | 'default';
  readonly token: string | null;
  readonly platform: 'ios' | 'android';
  readonly installationId: string;
  readonly error?: string;
}

export function getPushInstallationId(): Promise<string> {
  if (!installationPromise) {
    installationPromise = (async () => {
      const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
      if (existing) return existing;
      const id = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_KEY, id);
      return id;
    })().catch((error: unknown) => {
      installationPromise = null;
      throw error;
    });
  }
  return installationPromise;
}

export async function readNativePushState(
  action: PushAction,
  requestId: string,
): Promise<NativePushState> {
  let installationId = '';
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  let permission: NativePushState['permission'] = 'default';
  try {
    installationId = await getPushInstallationId();
    if (lastToken === null) lastToken = await SecureStore.getItemAsync(TOKEN_KEY);
    let authorization = await Notifications.getPermissionsAsync();
    if (action === 'push:enable' && authorization.status !== 'granted') {
      if (platform === 'android') {
        await Notifications.setNotificationChannelAsync('reading-reminders', {
          name: '읽기와 묵상 알림',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      authorization = await Notifications.requestPermissionsAsync();
    }
    permission = authorization.granted ? 'granted'
      : authorization.status === 'denied' ? 'denied' : 'default';
    if (permission === 'granted' && action !== 'push:disable') {
      if (!Device.isDevice) {
        return { requestId, permission, token: null, platform, installationId,
          error: '실제 기기에서 푸시 알림을 설정해 주세요.' };
      }
      if (platform === 'android') {
        await Notifications.setNotificationChannelAsync('reading-reminders', {
          name: '읽기와 묵상 알림',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      const result = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      lastToken = result.data;
      await SecureStore.setItemAsync(TOKEN_KEY, lastToken);
    }
    return { requestId, permission, token: lastToken, platform, installationId };
  } catch (error: unknown) {
    return { requestId, permission, token: lastToken, platform, installationId,
      error: error instanceof Error
        ? '기기 알림 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : '기기 알림을 확인하지 못했습니다.' };
  }
}

export function isPushBridgeRequest(value: unknown): value is {
  readonly type: PushAction; readonly requestId: string;
} {
  return typeof value === 'object' && value !== null
    && 'type' in value
    && (value.type === 'push:status' || value.type === 'push:enable' || value.type === 'push:disable')
    && 'requestId' in value && typeof value.requestId === 'string'
    && value.requestId.length > 0 && value.requestId.length <= 100;
}

export function isPushBridgeOrigin(url: string | undefined, webAppUrl: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === new URL(webAppUrl).origin;
  } catch {
    return false;
  }
}

export function nativePushStateScript(state: NativePushState): string {
  return `window.dispatchEvent(new CustomEvent('nativePushState', {detail:${JSON.stringify(state)}})); true;`;
}

export function pushDestination(value: unknown, webAppUrl: string, senderOrigin: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    if (senderOrigin !== new URL(webAppUrl).origin) return null;
    const target = new URL(value, webAppUrl);
    if (target.origin !== new URL(webAppUrl).origin) return null;
    if (!['/bible', '/hasena', '/plan', '/plans', '/notifications', '/friends', '/profile']
      .some(path => target.pathname === path || target.pathname.startsWith(`${path}/`))) return null;
    return `maeil1dok://${target.pathname.slice(1)}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}
