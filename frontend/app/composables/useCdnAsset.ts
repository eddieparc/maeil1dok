/**
 * CDN 에셋 URL 생성. NUXT_PUBLIC_CDN_BASE가 설정되면 CDN URL을,
 * 아니면 로컬 경로를 그대로 반환한다.
 * 사용: cdnAsset('/images/logo-transparent.png') → 'https://assets.maeil1dok.app/images/logo-transparent.png'
 *
 * useRuntimeConfig는 auto-import에 의존한다(명시 import 금지) —
 * 테스트 하네스가 소스를 esbuild로 직접 번들링하므로 '#app' import는
 * Nuxt 가상 모듈(#build/*) 해석 실패를 일으킨다. typeof 가드로
 * 하네스 환경에서는 로컬 경로로 폴백한다.
 */
export function useCdnAsset() {
  const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : null;
  const cdnBase = ((config?.public?.cdnBase as string) || '').replace(/\/$/, '');

  function cdnAsset(path: string): string {
    if (!cdnBase) return path;
    return `${cdnBase}${path}`;
  }

  return { cdnAsset, cdnBase };
}
