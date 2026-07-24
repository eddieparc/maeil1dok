import DOMPurify from 'dompurify';

/**
 * Server-safe HTML entity escape.
 *
 * DOMPurify requires a live DOM, which Nitro/Node SSR does not provide, so the
 * sanitizer cannot run during server rendering. Emitting the raw input into the
 * server-rendered document would let markup such as `<img onerror>` or
 * `<svg onload>` execute on first paint, before client hydration re-runs the
 * full DOM sanitizer. Escaping neutralizes every tag so no executable markup can
 * ever reach the client from the SSR pass.
 */
const escapeHtml = (html: string): string =>
  html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


export function useSanitize() {
  const sanitize = (html: string): string => {
    if (typeof html !== 'string' || html.length === 0) {
      return '';
    }
    if (typeof window === 'undefined' || typeof DOMPurify.sanitize !== 'function') {
      // No DOM available (SSR/Node): never emit unsanitized HTML.
      return escapeHtml(html);
    }
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'span',
        'div',
        'strong',
        'em',
        'sup',
        'sub',
        'b',
        'i',
        'u',
        'h2',
        'h3',
        'h4',
        'a',
        'svg',
        'path'
      ],
      ALLOWED_ATTR: [
        'class',
        'style',
        'data-verse',
        'data-highlight-id',
        'data-footnote',
        'href',
        'target',
        'rel',
        'title',
        'xmlns',
        'viewBox',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'd',
        'width',
        'height'
      ]
    });
  };

  return { sanitize };
}
