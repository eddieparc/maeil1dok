# Bible Content Strategy

> Architecture Decision Document for Plan B+
> Based on Plan A spike analysis (2026-02-25)

## Current State (Django)

- **Korean Bible**: Stored in `bible_cache/BibleContentCache` table (local DB)
- **Non-Korean (Hebrew, Greek, English)**: Fetched from API.Bible, cached in same table
- **API.Bible**: Does NOT support Korean → confirmed in spike analysis

## Supabase Migration Strategy

### Korean Bible Content
**Approach**: Direct table migration

1. Export `bible_cache_biblecontentcache` table from Django/MariaDB
2. Import into Supabase `bible_content_cache` table
3. Next.js reads from Supabase REST API instead of Django API

**Schema**:
```sql
CREATE TABLE public.bible_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  content JSONB NOT NULL,
  source TEXT,  -- 'local', 'api.bible', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book, chapter, language)
);

-- Public read (no auth required for Bible content)
ALTER TABLE public.bible_content_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bible_public_read" ON public.bible_content_cache
  FOR SELECT USING (true);  -- All users can read
```

### API.Bible (Non-Korean)
**Approach**: Server-side fetch from Next.js, cache in Supabase

```typescript
// Next.js server component / route handler
async function getBibleContent(book: string, chapter: number, language: string) {
  // 1. Check Supabase cache first
  const { data: cached } = await supabase
    .from('bible_content_cache')
    .select('content')
    .eq('book', book).eq('chapter', chapter).eq('language', language)
    .single();
  
  if (cached) return cached.content;
  
  // 2. Fetch from API.Bible (server-side only — API key not exposed to client)
  const content = await fetchFromApiBible(book, chapter, language);
  
  // 3. Cache in Supabase
  await supabase.from('bible_content_cache').upsert({
    book, chapter, language, content, source: 'api.bible'
  });
  
  return content;
}
```

## Decision: Korean Bible First

| Priority | Content | Source | Caching |
|----------|---------|--------|---------|
| 1st | Korean (KRV, NIV-Korean) | Local migration | Supabase table |
| 2nd | English | API.Bible | Supabase table |
| 3rd | Hebrew, Greek | API.Bible | Supabase table |

## Key Constraint
> API.Bible does NOT provide Korean Bible texts (Confirmed in spike)
> Korean Bible content must be migrated from existing Django database

## Environment Variables Needed
```env
APIBIBLE_KEY=your-api-bible-key
# Note: NEVER expose to client — server-side only
```
