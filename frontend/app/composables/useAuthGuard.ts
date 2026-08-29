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

export function useAuthGuard() {
  const auth = useAuthService();
  const navigationStore = useNavigationStore();
  const router = useRouter();
  const route = useRoute();
  const toast = useToast();

  /**
   * 인증이 필요한 작업 전에 호출
   * @param message - 커스텀 메시지 (기본값: '로그인이 필요합니다')
   * @returns true if authenticated, false if redirected to login
   */
  const requireAuth = (message: string = '로그인이 필요합니다'): boolean => {
    if (!auth.isAuthenticated.value) {
      toast.info(message);
      // 현재 페이지를 리다이렉트 URL로 저장 (로그인 후 복귀용)
      navigationStore.setRedirectUrl(route.fullPath);
      // A browser that was authenticated before and is being sent to the login
      // screen without having asked to sign out is the shape the migration is
      // trying to eliminate. Secondary signal only (see reauthMarker.ts).
      reportInvoluntaryReauthIfMarked(true);
      router.push('/login');
      return false;
    }
    return true;
  };

  return {
    requireAuth,
    isAuthenticated: auth.isAuthenticated,
  };
}
