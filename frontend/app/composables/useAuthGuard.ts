/**
 * useAuthGuard - 인증 체크 유틸리티
 *
 * 인증이 필요한 작업 전에 사용하여 비로그인 사용자를 로그인 페이지로 리다이렉트합니다.
 * 네비게이션 스토어를 사용하여 로그인 후 원래 페이지로 복귀할 수 있습니다.
 *
 * @example
 * const { requireAuth } = useAuthGuard();
 *
 * const handleAction = () => {
 *   if (!requireAuth()) return;
 *   // 인증된 사용자만 실행되는 코드
 * };
 */

import { reportInvoluntaryReauthIfMarked, useAuthService } from '~/composables/useAuthService';
import { useNavigationStore } from '~/stores/navigation';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';

export function useAuthGuard() {
  const auth = useAuthService();
  const navigationStore = useNavigationStore();
  const router = useRouter();
  const route = useRoute();
  const toast = useToast();
  const modal = useModal();

  const blockUnknownSession = (): boolean => {
    if (!auth.isSessionUnknown.value) return false;
    toast.warning('네트워크 연결을 확인한 후 다시 시도해주세요');
    return true;
  };

  const redirectToLogin = (returnUrl: string): void => {
    navigationStore.setRedirectUrl(returnUrl);
    // A browser that was authenticated before and is being sent to the login
    // screen without having asked to sign out is the shape the migration is
    // trying to eliminate. Secondary signal only (see reauthMarker.ts).
    reportInvoluntaryReauthIfMarked(true);
    void router.push('/login');
  };

  /**
   * 인증이 필요한 작업 전에 호출
   * @param message - 커스텀 메시지 (기본값: '로그인이 필요합니다')
   * @returns true if authenticated, false if redirected to login
   */
  const requireAuth = (message: string = '로그인이 필요합니다'): boolean => {
    if (blockUnknownSession()) return false;
    if (auth.isAuthenticated.value) return true;

    toast.info(message);
    redirectToLogin(route.fullPath);
    return false;
  };

  /**
   * Keeps the protected action blocked while an opt-in consumer offers login.
   * Confirmation navigates only after preserving the route captured at click time.
   */
  const requireAuthWithPrompt = async (message: string = '로그인이 필요합니다'): Promise<boolean> => {
    if (blockUnknownSession()) return false;
    if (auth.isAuthenticated.value) return true;

    const returnUrl = route.fullPath;
    const confirmed = await modal.confirm({
      title: '로그인 필요',
      description: message,
      confirmText: '로그인',
      cancelText: '취소',
      icon: 'info',
    });
    if (!confirmed) return false;

    // The originating guest action is never replayed after an async prompt.
    // If another flow authenticated meanwhile, avoid redundant login navigation.
    if (blockUnknownSession()) return false;
    if (!auth.isAuthenticated.value) redirectToLogin(returnUrl);
    return false;
  };

  return {
    requireAuth,
    requireAuthWithPrompt,
    isAuthenticated: auth.isAuthenticated,
  };
}
