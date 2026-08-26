const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeNumericEntity = (value: string, radix: 10 | 16): string => {
  const codePoint = Number.parseInt(value, radix);
  if (
    !Number.isInteger(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return '\ufffd';
  }
  return String.fromCodePoint(codePoint);
};

export const decodeBibleSearchHtmlEntities = (value: string): string => {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return decodeNumericEntity(code.slice(2), 16);
    }
    if (code.startsWith('#')) {
      return decodeNumericEntity(code.slice(1), 10);
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? entity;
  });
};

export const sanitizeBibleSearchSnippet = (snippet: string): string =>
  decodeBibleSearchHtmlEntities(snippet)
    .replace(/\s*직접입력\s*\[[^\]]+\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const highlightBibleSearchSnippet = (
  snippet: string,
  query: string,
): string => {
  const escapedSnippet = escapeHtml(sanitizeBibleSearchSnippet(snippet));
  if (!query) return escapedSnippet;

  return escapedSnippet.replace(
    new RegExp(`(${escapeRegExp(escapeHtml(query))})`, 'gi'),
    '<mark class="search-hit">$1</mark>',
  );
};
