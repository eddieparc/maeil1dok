import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())
const createServerRepositoriesMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: createServerRepositoriesMock,
}))

import { POST, PATCH } from '../bible/highlights/route'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

function request(method: string, rawBody?: string): Request {
  return new Request('http://localhost/api/bible/highlights', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function jsonRequest(method: string, body: unknown): Request {
  return request(method, JSON.stringify(body))
}

function createSupabase({ user = { id: 'user-1' }, authError = null } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
    },
  }
}

function createRepositories({
  getHighlights = vi.fn().mockResolvedValue([]),
  createHighlight = vi.fn().mockResolvedValue({ id: VALID_UUID }),
  updateHighlightColor = vi.fn().mockResolvedValue({ id: VALID_UUID, color: 'green' }),
} = {}) {
  return {
    highlight: { getHighlights, createHighlight, updateHighlightColor },
    getHighlights,
    createHighlight,
    updateHighlightColor,
  }
}

const validPostBody = {
  book: 'gen',
  chapter: 1,
  verseStart: 1,
  verseEnd: 3,
  color: 'yellow',
  version: 'GAE',
}

describe('POST /api/bible/highlights — body validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 before parsing for unauthenticated malformed JSON', async () => {
    createClientMock.mockResolvedValue(createSupabase({ user: null }))

    const response = await POST(request('POST', '{ not json'))

    expect(response.status).toBe(401)
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON without touching the repository', async () => {
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(request('POST', '{ not json'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [validPostBody]],
    ['string', 'gen'],
    ['number', 3],
    ['boolean', true],
  ])('returns 400 for top-level %s JSON before repository access', async (_label, body) => {
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(jsonRequest('POST', body))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Request body must be an object' })
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing book', { ...validPostBody, book: undefined }],
    ['non-string book', { ...validPostBody, book: 42 }],
    ['blank book', { ...validPostBody, book: '   ' }],
    ['missing version', { ...validPostBody, version: undefined }],
    ['non-string version', { ...validPostBody, version: true }],
    ['blank version', { ...validPostBody, version: '' }],
    ['invalid color', { ...validPostBody, color: 'orange' }],
    ['non-string color', { ...validPostBody, color: 5 }],
    ['zero chapter', { ...validPostBody, chapter: 0 }],
    ['float chapter', { ...validPostBody, chapter: 1.5 }],
    ['string chapter', { ...validPostBody, chapter: '1' }],
    ['non-positive verseStart', { ...validPostBody, verseStart: 0 }],
    ['float verseEnd', { ...validPostBody, verseEnd: 3.2 }],
    ['reversed verse range', { ...validPostBody, verseStart: 5, verseEnd: 2 }],
  ])('returns 400 for %s without touching the repository', async (_label, body) => {
    const repositories = createRepositories()
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(jsonRequest('POST', body))

    expect(response.status).toBe(400)
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
    expect(repositories.getHighlights).not.toHaveBeenCalled()
    expect(repositories.createHighlight).not.toHaveBeenCalled()
    expect(repositories.updateHighlightColor).not.toHaveBeenCalled()
  })

  it('creates a highlight with trimmed book/version on a valid body', async () => {
    const repositories = createRepositories()
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(
      jsonRequest('POST', { ...validPostBody, book: '  gen  ', version: '  GAE  ' })
    )

    expect(response.status).toBe(201)
    expect(repositories.getHighlights).toHaveBeenCalledWith('gen', 1, 'GAE')
    expect(repositories.createHighlight).toHaveBeenCalledWith({
      book: 'gen',
      chapter: 1,
      verseStart: 1,
      verseEnd: 3,
      color: 'yellow',
      version: 'GAE',
    })
  })

  it('updates color on an exact-overlap match instead of creating', async () => {
    const repositories = createRepositories({
      getHighlights: vi
        .fn()
        .mockResolvedValue([{ id: VALID_UUID, verseStart: 1, verseEnd: 3 }]),
    })
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(jsonRequest('POST', validPostBody))

    expect(response.status).toBe(200)
    expect(repositories.updateHighlightColor).toHaveBeenCalledWith(VALID_UUID, 'yellow')
    expect(repositories.createHighlight).not.toHaveBeenCalled()
  })

  it('returns 409 for a non-exact overlap', async () => {
    const repositories = createRepositories({
      getHighlights: vi
        .fn()
        .mockResolvedValue([{ id: VALID_UUID, verseStart: 1, verseEnd: 2 }]),
    })
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await POST(jsonRequest('POST', validPostBody))

    expect(response.status).toBe(409)
    expect(repositories.createHighlight).not.toHaveBeenCalled()
    expect(repositories.updateHighlightColor).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/bible/highlights — body validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 before parsing for unauthenticated malformed JSON', async () => {
    createClientMock.mockResolvedValue(createSupabase({ user: null }))

    const response = await PATCH(request('PATCH', '{ not json'))

    expect(response.status).toBe(401)
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON without touching the repository', async () => {
    createClientMock.mockResolvedValue(createSupabase())

    const response = await PATCH(request('PATCH', '{ not json'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [{ id: VALID_UUID, color: 'green' }]],
    ['string', 'green'],
    ['number', 3],
    ['boolean', true],
  ])('returns 400 for top-level %s JSON before repository access', async (_label, body) => {
    createClientMock.mockResolvedValue(createSupabase())

    const response = await PATCH(jsonRequest('PATCH', body))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Request body must be an object' })
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing id', { color: 'green' }],
    ['non-UUID id', { id: 'highlight-1', color: 'green' }],
    ['numeric id', { id: 42, color: 'green' }],
    ['object id', { id: {}, color: 'green' }],
    ['invalid color', { id: VALID_UUID, color: 'orange' }],
    ['missing color', { id: VALID_UUID }],
  ])('returns 400 for %s without touching the repository', async (_label, body) => {
    const repositories = createRepositories()
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await PATCH(jsonRequest('PATCH', body))

    expect(response.status).toBe(400)
    expect(createServerRepositoriesMock).not.toHaveBeenCalled()
    expect(repositories.updateHighlightColor).not.toHaveBeenCalled()
  })

  it('updates the highlight color on a valid UUID/color body', async () => {
    const repositories = createRepositories()
    createServerRepositoriesMock.mockReturnValue(repositories)
    createClientMock.mockResolvedValue(createSupabase())

    const response = await PATCH(jsonRequest('PATCH', { id: VALID_UUID, color: 'green' }))

    expect(response.status).toBe(200)
    expect(repositories.updateHighlightColor).toHaveBeenCalledWith(VALID_UUID, 'green')
  })
})
