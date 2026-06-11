const BLOCK_TAG_PATTERN = /<\/?(?:article|div|p|section|li|tr|br|h[1-6])\b[^>]*>/gi;
const SCRIPT_STYLE_PATTERN = /<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi;
const VERSE_MARKER_PATTERN = /(^|[\n\r]|(?<=[.!?。！？다요오니라”"']))\s*(\d{1,3})\s+(?=[가-힣A-Za-z"“'‘])/g;

const decodeEntities = (value) => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

const stripTags = (value) => decodeEntities(
  value
    .replace(SCRIPT_STYLE_PATTERN, '')
    .replace(BLOCK_TAG_PATTERN, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\s*\n\s*/g, '\n')
  .trim();

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const extractFirstClassText = (html, className) => {
  const pattern = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  const match = html.match(pattern);
  return match ? stripTags(match[1]) : '';
};

const extractContentScope = (html) => {
  const match = html.match(/<[^>]*class=["'][^"']*bible_contents[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div|section)>/i);
  return match ? match[1] : html;
};

const parseClassBasedVerses = (html) => {
  const verses = [];
  const blockPattern = /<(?:p|div|li)\b[^>]*>([\s\S]*?)<\/(?:p|div|li)>/gi;
  const blocks = [...html.matchAll(blockPattern)].map((match) => match[1]);

  for (const block of blocks) {
    const number = extractFirstClassText(block, 'bullet_number');
    const text = extractFirstClassText(block, 'bullet_txt');
    if (number && text) {
      verses.push({ number, text });
    }
  }

  if (verses.length > 0) {
    return verses;
  }

  const numberPattern = /<[^>]*class=["'][^"']*bullet_number[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
  const textPattern = /<[^>]*class=["'][^"']*bullet_txt[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
  const numbers = [...html.matchAll(numberPattern)].map((match) => stripTags(match[1]));
  const texts = [...html.matchAll(textPattern)].map((match) => stripTags(match[1]));

  return numbers
    .map((number, index) => ({ number, text: texts[index] || '' }))
    .filter((verse) => verse.number && verse.text);
};

const parseTextVerses = (text) => {
  const normalized = text.replace(/[ \t\f\v]+/g, ' ').trim();
  const matches = [...normalized.matchAll(VERSE_MARKER_PATTERN)];

  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const markerStart = match.index + match[1].length;
    const textStart = markerStart + match[2].length;
    const nextMatch = matches[index + 1];
    const textEnd = nextMatch ? nextMatch.index : normalized.length;

    return {
      number: match[2],
      text: normalized.slice(textStart, textEnd).trim(),
    };
  }).filter((verse) => verse.text);
};

const renderVerses = (verses) => verses.map((verse) => `
  <div class="hasena-verse">
    <span class="hasena-verse-number">${escapeHtml(verse.number)}</span>
    <span class="hasena-verse-text">${escapeHtml(verse.text)}</span>
  </div>
`).join('');

export const parseHasenaContent = (html) => {
  const title = extractFirstClassText(html, 'bible_tit');
  const contentScope = extractContentScope(html);
  const classBasedVerses = parseClassBasedVerses(contentScope);
  const verses = classBasedVerses.length > 0
    ? classBasedVerses
    : parseTextVerses(stripTags(contentScope));

  return {
    title,
    verses,
    html: renderVerses(verses),
  };
};

const normalizeSummaryHeading = (line) => line
  .replace(/^#{1,6}\s*/, '')
  .replace(/^\d+\.\s*/, '')
  .replace(/^\*\*(.*?)\*\*[:：]?\s*$/, '$1')
  .replace(/^(.+?)[:：]\s*$/, '$1')
  .trim();

const getSummarySectionKey = (line) => {
  const heading = normalizeSummaryHeading(line);
  if (/오늘의\s*본문|^본문$|성경\s*본문/.test(heading)) return 'bible';
  if (/교역자\s*해설|해설|묵상/.test(heading)) return 'commentary';
  if (/하시조|실천/.test(heading)) return 'action';
  return null;
};

const splitSummarySections = (summary) => {
  const sections = { bible: [], commentary: [], action: [] };
  let current = null;

  for (const rawLine of summary.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const key = getSummarySectionKey(line);
    if (key) {
      current = key;
      continue;
    }

    if (current && line) {
      sections[current].push(line);
    }
  }

  return sections;
};

const processInlineMarkdown = (value) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<span class="highlight-text">$1</span>');

const processParagraph = (lines) => lines.map(processInlineMarkdown).join('<br>');

const processChecklist = (lines) => lines.map((line) => {
  const text = line.replace(/^\s*[-*]\s*(?:\[\s*\])?\s*/, '').trim();
  if (!text) return '';

  return `<div class="checklist-item">
    <span class="check-icon" aria-hidden="true">✓</span>
    <span class="checklist-text">${processInlineMarkdown(text)}</span>
  </div>`;
}).join('');

export const formatHasenaSummary = (summary) => {
  const sections = splitSummarySections(summary);

  if (!sections.bible.length && !sections.commentary.length && !sections.action.length) {
    return escapeHtml(summary).replace(/\n/g, '<br>');
  }

  let html = '';
  if (sections.bible.length) {
    html += `<div class="summary-section bible-section">
      <h4 class="section-title">오늘의 본문</h4>
      <div class="section-body"><p class="section-text">${processParagraph(sections.bible)}</p></div>
    </div>`;
  }

  if (sections.commentary.length) {
    html += `<div class="summary-section commentary-section">
      <h4 class="section-title">교역자 해설</h4>
      <div class="section-body"><p class="section-text">${processParagraph(sections.commentary)}</p></div>
    </div>`;
  }

  if (sections.action.length) {
    html += `<div class="summary-divider"></div>
      <div class="summary-section action-section">
        <h4 class="section-title">오늘의 하시조</h4>
        <div class="checklist-container">${processChecklist(sections.action)}</div>
      </div>`;
  }

  return html;
};
