import { computed, onMounted, ref } from 'vue';
import type { AuthUser } from '~/composables/useAuthService';
import { useAuthService } from '~/composables/useAuthService';
import {
  parseCachedAuthUser,
  resolveFirstPaintState,
  resolveLandingDisplayUser,
} from '~/utils/landingAuthState';

function readCachedAuthUser(): AuthUser | null {
  if (!import.meta.client) return null;

  try {
    return parseCachedAuthUser(localStorage.getItem('auth'));
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

export function useLandingAuthState() {
  const auth = useAuthService();
  const hasHydrated = ref(false);
  const cachedUser = ref<AuthUser | null>(null);
  const displayUser = computed(() => resolveLandingDisplayUser(
    auth.user.value,
    auth.isInitialized.value,
    cachedUser.value,
  ));
  const isKnownAuthenticated = computed(() => auth.isAuthenticated.value || displayUser.value !== null);
  const isFirstPaintPending = computed(() => resolveFirstPaintState(hasHydrated.value));

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
