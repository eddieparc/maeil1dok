/**
 * HTML 관련 유틸리티.
 */

/**
 * Server-safe HTML entity escape.
 *
 * DOMPurify requires a live DOM, which Nitro/Node SSR does not provide, so the
 * sanitizer cannot run during server rendering. Emitting the raw input into the
 * server-rendered document would let markup such as `<img onerror>` or
 * `<svg onload>` execute on first paint, before client hydration re-runs the
 * full DOM sanitizer. Escaping neutralizes every tag so no executable markup can
 * ever reach the client from the SSR pass.
 *
 * `&`를 가장 먼저 이스케이프해야 이중 인코딩이 생기지 않는다.
 */
export const escapeHtml = (html: string): string =>
  html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
