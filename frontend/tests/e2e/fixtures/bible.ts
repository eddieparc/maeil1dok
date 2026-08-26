import type { components } from '../../../app/types/generated/api-schema';
import type { ApiMock } from './api';

const verseHtml = (verse: number): string => `
  <span>
    <span class="number">${verse}</span>
    회귀를 막는 브라우저 말씀 ${verse}. 충분한 본문 높이를 만드는 결정적 테스트 문장입니다.
  </span>
`;

export const mockBibleChapter = (
  api: ApiMock,
  {
    version = 'GAE',
    book,
    chapter,
    verseCount = 24,
  }: {
    version?: string;
    book: string;
    chapter: number;
    verseCount?: number;
  },
): void => {
  const content = `
    <div id="tdBible1">
      <span class="chapNum">제${chapter}장</span>
      ${Array.from({ length: verseCount }, (_, index) => verseHtml(index + 1)).join('')}
    </div>
  `;
  const response = {
    success: true,
    data: {
      version,
      book,
      chapter,
      content,
      content_type: 'html',
      from_cache: true,
    },
  } satisfies components['schemas']['BibleContentResponse'];

  api.get('/api/v1/bible-cache/{version}/{book}/{chapter}/', response);
};
