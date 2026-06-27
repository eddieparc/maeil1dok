import { computed, onMounted, ref } from 'vue';
import type { AuthUser } from '~/composables/useAuthService';
import { useAuthService } from '~/composables/useAuthService';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCachedAuthUser(): AuthUser | null {
  if (!import.meta.client) return null;

  try {
    const rawAuth = localStorage.getItem('auth');
    if (!rawAuth) return null;

    const parsedAuth: unknown = JSON.parse(rawAuth);
    if (!isRecord(parsedAuth) || !isRecord(parsedAuth.user)) return null;

    const { id, username, nickname, email, profile_image, is_staff, email_verified, has_usable_password_flag } = parsedAuth.user;
    if (typeof id !== 'number' || typeof username !== 'string' || typeof nickname !== 'string') return null;

    return {
      id,
      username,
      nickname,
      ...(typeof email === 'string' ? { email } : {}),
      ...(typeof profile_image === 'string' ? { profile_image } : {}),
      ...(typeof is_staff === 'boolean' ? { is_staff } : {}),
      ...(typeof email_verified === 'boolean' ? { email_verified } : {}),
      ...(typeof has_usable_password_flag === 'boolean' ? { has_usable_password_flag } : {}),
    };
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

export function useLandingAuthState() {
  const auth = useAuthService();
  const hasHydrated = ref(false);
  const cachedUser = ref<AuthUser | null>(null);
  const displayUser = computed(() => auth.user.value ?? (auth.isInitialized.value ? null : cachedUser.value));
  const isKnownAuthenticated = computed(() => auth.isAuthenticated.value || displayUser.value !== null);
  const isFirstPaintPending = computed(() => !hasHydrated.value);

  onMounted(() => {
    cachedUser.value = auth.user.value ?? readCachedAuthUser();
    hasHydrated.value = true;
  });

  return {
    auth,
    displayUser,
    isKnownAuthenticated,
    isFirstPaintPending,
  };
}
