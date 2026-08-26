import { expect, test as base, type Page, type Route } from '@playwright/test';
import type {
  ApiPathFor,
  ApiResponseBody,
} from '../../../app/types/api-contract';
import type { components } from '../../../app/types/generated/api-schema';

const API_ORIGINS = [
  'http://127.0.0.1:8019',
  'http://localhost:8019',
] as const;

const TEST_USER = {
  id: 7,
  username: 'playwright-reader',
  nickname: '브라우저 독자',
  email: 'reader@example.com',
  profile_image: null,
  is_staff: false,
  email_verified: true,
  has_usable_password_flag: true,
} satisfies components['schemas']['User'];

const READING_SETTINGS = {
  success: true,
  message: 'ok',
  data: {
    settings: {
      theme: 'light',
      font_family: 'ridi-batang',
      font_size: 16,
      font_weight: 'normal',
      line_height: 1.8,
      text_align: 'left',
      verse_joining: false,
      show_verse_numbers: true,
      show_description: true,
      show_cross_ref: true,
      highlight_names: true,
      show_footnotes: true,
      tongdok_auto_complete: false,
    },
  },
} satisfies components['schemas']['ReadingSettingsResponse'];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type MockedResponse = {
  readonly method: HttpMethod;
  readonly pathPattern: RegExp;
  readonly body: unknown;
  readonly status: number;
};

const pathPattern = (template: string): RegExp => {
  const pattern = template
    .split('/')
    .map((segment) => segment.startsWith('{') && segment.endsWith('}')
      ? '[^/]+'
      : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/');
  return new RegExp(`^${pattern}$`);
};

const corsHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, X-CSRFToken',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:3019',
};

export class ApiMock {
  readonly #page: Page;
  readonly #responses: MockedResponse[] = [];

  constructor(page: Page) {
    this.#page = page;
  }

  async install(): Promise<void> {
    for (const origin of API_ORIGINS) {
      await this.#page.route(`${origin}/**`, (route) => this.#handle(route));
    }
  }

  get<Path extends ApiPathFor<'get'>>(
    path: Path,
    body: ApiResponseBody<Path, 'get'>,
    status = 200,
  ): void {
    this.#add('GET', path, body, status);
  }

  post<Path extends ApiPathFor<'post'>>(
    path: Path,
    body: ApiResponseBody<Path, 'post'>,
    status = 200,
  ): void {
    this.#add('POST', path, body, status);
  }

  async authenticate(user: components['schemas']['User'] = TEST_USER): Promise<void> {
    await this.#page.addInitScript((authenticatedUser) => {
      localStorage.setItem('auth', JSON.stringify({ user: authenticatedUser }));
    }, user);
    this.get('/api/v1/auth/user/', user);
    this.get('/api/v1/auth/reading-settings/', READING_SETTINGS);
  }

  #add(method: HttpMethod, path: string, body: unknown, status: number): void {
    this.#responses.unshift({
      method,
      pathPattern: pathPattern(path),
      body,
      status,
    });
  }

  async #handle(route: Route): Promise<void> {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const url = new URL(request.url());
    const response = this.#responses.find((candidate) =>
      candidate.method === request.method() && candidate.pathPattern.test(url.pathname));

    if (!response) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ detail: `No Playwright API fixture for ${request.method()} ${url.pathname}` }),
      });
      return;
    }

    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      headers: corsHeaders,
      body: response.status === 204 ? undefined : JSON.stringify(response.body),
    });
  }
}

type ApiFixtures = {
  api: ApiMock;
};

export const test = base.extend<ApiFixtures>({
  api: async ({ page }, use) => {
    const api = new ApiMock(page);
    await api.install();
    await use(api);
  },
});

export { expect };
