# Migration Strategy: Django+MySQL → Next.js 15+Supabase

**Document Version:** 1.0  
**Date:** 2026-02-26  
**Status:** Plan B (Schema Definition Complete)

---

## Table of Contents

1. [User Migration](#section-1-user-migration)
2. [Data Migration (Table-by-Table)](#section-2-data-migration-table-by-table)
3. [Korean Bible Migration (ETL Plan)](#section-3-korean-bible-migration-etl-plan)
4. [Timezone Handling](#section-4-timezone-handling)
5. [Cutover Plan (Big Bang)](#section-5-cutover-plan-big-bang)
6. [Rollback Plan](#section-6-rollback-plan)

---

## Section 1: User Migration

### Overview
Migrating user accounts from Django's `auth_user` table to Supabase's `auth.users` is the most critical step, as all other data depends on user identity.

### Challenge: Password Hash Incompatibility
- **Django Storage:** Passwords are hashed using bcrypt or argon2 and stored in `auth_user.password` field
- **Supabase Auth:** Uses its own password hashing mechanism (bcrypt with specific salt rounds)
- **Direct Import:** Not possible—Django hashes cannot be directly imported into Supabase

### Migration Strategy: Invite-Based Re-authentication

**Step 1: Create Profiles in Supabase**
- Export all Django users (id, email, username, nickname, profile_image)
- Create corresponding `profiles` records in Supabase with user_id as UUID
- Users are NOT yet created in `auth.users`

**Step 2: Send Magic Link Invitations**
- Generate magic link invitations for each user's email
- Use Supabase's `admin.auth.inviteUserByEmail()` API
- Email contains link to set new password or use passwordless login

**Step 3: User Completes Registration**
- User clicks magic link
- Sets new password (or uses passwordless auth)
- Supabase creates `auth.users` record with new password hash
- User is now fully migrated

### Field Mapping

| Django Field | Supabase Field | Notes |
|---|---|---|
| `auth_user.id` | `auth.users.id` | Convert INT to UUID (generate new) |
| `auth_user.email` | `auth.users.email` | Direct copy |
| `auth_user.username` | `profiles.username` | Store in profiles table |
| `auth_user.first_name` | `profiles.first_name` | Optional, store in profiles |
| `auth_user.last_name` | `profiles.last_name` | Optional, store in profiles |
| `UserProfile.nickname` | `profiles.nickname` | Direct copy |
| `UserProfile.bio` | `profiles.bio` | Direct copy |
| `UserProfile.total_completed_days` | `profiles.total_completed_days` | Direct copy |
| `UserProfile.current_streak` | `profiles.current_streak` | Direct copy |
| `UserProfile.longest_streak` | `profiles.longest_streak` | Direct copy |
| `UserProfile.is_public` | `profiles.is_public` | Direct copy |
| `User.profile_image` | `profiles.profile_image` | Direct copy (URL) |
| `auth_user.created_at` | `profiles.created_at` | Convert timezone (see Section 4) |

### Social Account Handling
- Django `SocialAccount` records are NOT migrated to Supabase auth
- Instead, store social account info in a custom `social_accounts` table (future enhancement)
- Users can re-link social accounts after migration

---

## Section 2: Data Migration (Table-by-Table)

### Table 1: UserProfile → profiles

**Django Model:** `accounts.models.UserProfile`  
**Supabase Table:** `public.profiles`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `bio` | `bio` | TEXT | Direct copy |
| `total_completed_days` | `total_completed_days` | INT | Direct copy |
| `current_streak` | `current_streak` | INT | Direct copy |
| `longest_streak` | `longest_streak` | INT | Direct copy |
| `is_public` | `is_public` | BOOLEAN | Direct copy |
| `joined_date` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| — | `updated_at` | TIMESTAMPTZ | Set to current time |

**Migration Script Approach:**
```python
# Pseudocode
for user_profile in UserProfile.objects.all():
    supabase.table('profiles').insert({
        'user_id': migrate_user_id(user_profile.user_id),
        'bio': user_profile.bio,
        'total_completed_days': user_profile.total_completed_days,
        'current_streak': user_profile.current_streak,
        'longest_streak': user_profile.longest_streak,
        'is_public': user_profile.is_public,
        'created_at': convert_timezone(user_profile.joined_date),
        'updated_at': datetime.now(timezone.utc)
    })
```

---

### Table 2: BibleReadingPlan → bible_reading_plans

**Django Model:** `todos.models.BibleReadingPlan`  
**Supabase Table:** `public.bible_reading_plans`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → SERIAL | Preserve Django ID for data integrity |
| `name` | `name` | TEXT | Direct copy |
| `description` | `description` | TEXT | Direct copy |
| `is_default` | `is_default` | BOOLEAN | Direct copy |
| `is_active` | `is_active` | BOOLEAN | Direct copy |
| `created_by` (FK) | `created_by` | INT → UUID | Use migrated auth.users.id |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Key Note:** `id` is SERIAL (INTEGER), not UUID, to maintain compatibility with Django's integer primary keys.

---

### Table 3: PlanSubscription → plan_subscriptions

**Django Model:** `todos.models.PlanSubscription`  
**Supabase Table:** `public.plan_subscriptions`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `plan_id` (FK) | `plan_id` | INT | Direct copy (matches bible_reading_plans.id) |
| `start_date` | `start_date` | DATE | Direct copy |
| `is_active` | `is_active` | BOOLEAN | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(user_id, plan_id) enforced in Supabase

---

### Table 4: DailyBibleSchedule → daily_schedules

**Django Model:** `todos.models.DailyBibleSchedule`  
**Supabase Table:** `public.daily_schedules`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `plan_id` (FK) | `plan_id` | INT | Direct copy (matches bible_reading_plans.id) |
| `date` | `date` | DATE | Direct copy |
| `book` | `book` | TEXT | Direct copy (e.g., "Genesis", "Exodus") |
| `start_chapter` | `start_chapter` | INT | Direct copy |
| `end_chapter` | `end_chapter` | INT | Direct copy |
| `audio_link` | `audio_link` | TEXT | Direct copy (nullable) |
| `guide_link` | `guide_link` | TEXT | Direct copy (nullable) |
| — | `created_at` | TIMESTAMPTZ | Set to current time |

**Key Change:** Django uses single `chapter` field; Supabase uses `start_chapter` + `end_chapter` for range support.

---

### Table 5: UserBibleProgress → user_progress

**Django Model:** `todos.models.UserBibleProgress`  
**Supabase Table:** `public.user_progress`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `subscription_id` (FK) | `subscription_id` | INT → UUID | Use migrated plan_subscriptions.id |
| `schedule_id` (FK) | `schedule_id` | INT → UUID | Use migrated daily_schedules.id |
| `is_completed` | `is_completed` | BOOLEAN | Direct copy |
| `completed_at` | `completed_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC), nullable |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

---

### Table 6: UserPlanDisplaySettings → user_plan_display_settings

**Django Model:** `todos.models.UserPlanDisplaySettings`  
**Supabase Table:** `public.user_plan_display_settings`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `subscription_id` (FK) | `subscription_id` | INT → UUID | Use migrated plan_subscriptions.id |
| `color` | `color` | VARCHAR(7) | Direct copy (HEX color) |
| `display_order` | `display_order` | INT | Direct copy |
| `is_visible` | `is_visible` | BOOLEAN | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(subscription_id) enforced in Supabase

---

### Table 7: UserReadingSettings → user_reading_settings

**Django Model:** `accounts.models.UserReadingSettings`  
**Supabase Table:** `public.user_reading_settings`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `theme` | `theme` | TEXT | Direct copy (light/dark/system) |
| `font_family` | `font_family` | TEXT | Direct copy |
| `font_size` | `font_size` | INT | Direct copy |
| `font_weight` | `font_weight` | TEXT | Direct copy |
| `line_height` | `line_height` | NUMERIC | Direct copy |
| `text_align` | `text_align` | TEXT | Direct copy |
| `verse_joining` | `verse_joining` | BOOLEAN | Direct copy |
| `show_verse_numbers` | `show_verse_numbers` | BOOLEAN | Direct copy |
| `show_description` | `show_description` | BOOLEAN | Direct copy |
| `show_cross_ref` | `show_cross_ref` | BOOLEAN | Direct copy |
| `highlight_names` | `highlight_names` | BOOLEAN | Direct copy |
| `show_footnotes` | `show_footnotes` | BOOLEAN | Direct copy |
| `tongdok_auto_complete` | `tongdok_auto_complete` | BOOLEAN | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(user_id) enforced in Supabase

---

### Table 8: UserReadingPosition → user_reading_positions

**Django Model:** `todos.models.UserReadingPosition`  
**Supabase Table:** `public.user_reading_positions`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `book` | `book` | TEXT | Direct copy (e.g., "gen", "exo") |
| `chapter` | `chapter` | INT | Direct copy |
| `verse` | `verse` | INT | Direct copy (nullable) |
| `scroll_position` | `scroll_position` | NUMERIC | Direct copy |
| `version` | `version` | TEXT | Direct copy (e.g., "GAE", "KNT") |
| — | `updated_at` | TIMESTAMPTZ | Set to current time |

**Constraint:** UNIQUE(user_id) enforced in Supabase

---

### Table 9: VideoBibleIntro → video_bible_intros

**Django Model:** `todos.models.VideoBibleIntro`  
**Supabase Table:** `public.video_bible_intros`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `plan_id` (FK) | `plan_id` | INT | Direct copy (matches bible_reading_plans.id) |
| `book` | `book` | TEXT | Direct copy |
| `url_link` | `url_link` | TEXT | Direct copy |
| `start_date` | `start_date` | DATE | Direct copy |
| `end_date` | `end_date` | DATE | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(plan_id, book) enforced in Supabase

---

### Table 10: UserVideoIntroProgress → user_video_intro_progress

**Django Model:** `todos.models.UserVideoIntroProgress`  
**Supabase Table:** `public.user_video_intro_progress`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `video_intro_id` (FK) | `video_intro_id` | INT → UUID | Use migrated video_bible_intros.id |
| `is_completed` | `is_completed` | BOOLEAN | Direct copy |
| `completed_at` | `completed_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC), nullable |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(user_id, video_intro_id) enforced in Supabase

---

### Table 11: HasenaRecord → hasena_records

**Django Model:** `todos.models.HasenaRecord`  
**Supabase Table:** `public.hasena_records`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `user_id` (FK) | `user_id` | INT → UUID | Use migrated auth.users.id |
| `date` | `date` | DATE | Direct copy |
| `is_completed` | `is_completed` | BOOLEAN | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(user_id, date) enforced in Supabase

---

### Table 12: HasenaSummary → hasena_summaries

**Django Model:** `todos.models.HasenaSummary`  
**Supabase Table:** `public.hasena_summaries`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `video_id` | `video_id` | TEXT | Direct copy (unique) |
| `video_date` | `video_date` | DATE | Direct copy (nullable) |
| `title` | `title` | TEXT | Direct copy |
| `summary` | `summary` | TEXT | Direct copy |
| `transcript` | `transcript` | TEXT | Direct copy |
| `model_used` | `model_used` | TEXT | Direct copy |
| `is_edited` | `is_edited` | BOOLEAN | Direct copy |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(video_id) enforced in Supabase

---

### Table 13: CatchupSession → catchup_sessions

**Django Model:** `todos.models.CatchupSession`  
**Supabase Table:** `public.catchup_sessions`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `subscription_id` (FK) | `subscription_id` | INT → UUID | Use migrated plan_subscriptions.id |
| `name` | `name` | TEXT | Direct copy |
| `range_start` | `range_start` | DATE | Direct copy |
| `range_end` | `range_end` | DATE | Direct copy |
| `strategy` | `strategy` | TEXT | Direct copy (parallel/sequential) |
| `target_rejoin_date` | `target_rejoin_date` | DATE | Direct copy (nullable) |
| `max_daily_readings` | `max_daily_readings` | INT | Direct copy (nullable) |
| `max_daily_chapters` | `max_daily_chapters` | INT | Direct copy (nullable) |
| `weekend_multiplier` | `weekend_multiplier` | NUMERIC | Direct copy |
| `status` | `status` | TEXT | Direct copy (active/completed/abandoned) |
| `completed_at` | `completed_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC), nullable |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

---

### Table 14: CatchupSchedule → catchup_schedules

**Django Model:** `todos.models.CatchupSchedule`  
**Supabase Table:** `public.catchup_schedules`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `session_id` (FK) | `session_id` | INT → UUID | Use migrated catchup_sessions.id |
| `original_schedule_id` (FK) | `original_schedule_id` | INT → UUID | Use migrated daily_schedules.id |
| `scheduled_date` | `scheduled_date` | DATE | Direct copy |
| `is_completed` | `is_completed` | BOOLEAN | Direct copy |
| `completed_at` | `completed_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC), nullable |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(session_id, original_schedule_id) enforced in Supabase

---

### Table 15: BibleContentCache → bible_content_cache

**Django Model:** `todos.models.BibleContentCache` (not shown in models.py, but referenced in schema)  
**Supabase Table:** `public.bible_content_cache`

| Django Field | Supabase Field | Type Conversion | Notes |
|---|---|---|---|
| `id` | `id` | INT → UUID | Generate new UUID |
| `book` | `book` | TEXT | Direct copy |
| `chapter` | `chapter` | INT | Direct copy |
| `language` | `language` | TEXT | Direct copy (default: 'ko') |
| `version` | `version` | TEXT | Direct copy (e.g., 'GAE', 'KNT', 'HAN') |
| `content` | `content` | JSON → JSONB | Direct copy (PostgreSQL JSONB) |
| `source` | `source` | TEXT | Direct copy (nullable) |
| `created_at` | `created_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |
| `updated_at` | `updated_at` | DATETIME → TIMESTAMPTZ | Add 9 hours (KST→UTC) |

**Constraint:** UNIQUE(book, chapter, language, version) enforced in Supabase

---

## Section 3: Korean Bible Migration (ETL Plan)

### Overview
The Korean Bible content is stored in `BibleContentCache` as JSON/JSONB. This section documents the ETL (Extract, Transform, Load) strategy for migrating this data.

### Data Structure

**Composite Key:** `(book, chapter, language, version)`

**Supported Versions:**
- `GAE` - 개역개정 (Korean Standard Version)
- `KNT` - 킹제임스 신약 (King James New Testament)
- `HAN` - 한글킹제임스 (Korean King James)
- `SAE` - 새번역 (New Korean Translation)
- `SAENEW` - 새번역 개정판 (New Korean Translation Revised)
- `COG` - 공동번역 (Common Translation)
- `COGNEW` - 공동번역 개정판 (Common Translation Revised)

**Content Structure (JSONB):**
```json
{
  "book": "Genesis",
  "chapter": 1,
  "verses": [
    {
      "verse": 1,
      "text": "태초에 하나님이 천지를 창조하셨다."
    },
    {
      "verse": 2,
      "text": "땅이 혼돈하고 공허하며..."
    }
  ],
  "metadata": {
    "version": "GAE",
    "language": "ko",
    "source": "..."
  }
}
```

### ETL Approach

**Phase 1: Extract (Django MySQL)**
```python
# Read from Django BibleContentCache
for cache in BibleContentCache.objects.all():
    data = {
        'book': cache.book,
        'chapter': cache.chapter,
        'language': cache.language,
        'version': cache.version,
        'content': cache.content,  # JSON field
        'source': cache.source,
        'created_at': cache.created_at,
        'updated_at': cache.updated_at
    }
    # Store in temporary file or queue
```

**Phase 2: Transform**
- Convert Django datetime to UTC (add 9 hours for KST)
- Validate JSONB structure
- Ensure composite key uniqueness
- Check for missing or corrupted records

**Phase 3: Load (Supabase PostgreSQL)**
```python
# Insert into Supabase via REST API or direct connection
supabase.table('bible_content_cache').insert({
    'book': data['book'],
    'chapter': data['chapter'],
    'language': data['language'],
    'version': data['version'],
    'content': data['content'],  # JSONB
    'source': data['source'],
    'created_at': convert_timezone(data['created_at']),
    'updated_at': convert_timezone(data['updated_at'])
})
```

### Deferred to Plan C
- Full ETL implementation and execution
- Bible content validation and quality checks
- Performance optimization for large-scale imports
- Fallback strategies for partial failures

**Current Status (Plan B):** Schema only—no data migration yet.

---

## Section 4: Timezone Handling

### Problem Statement
Django stores naive datetimes (no timezone info) in MySQL. Supabase uses `timestamptz` (UTC with timezone awareness).

### Assumption
All Django datetimes are stored in **KST (Korea Standard Time, UTC+9)**.

### Conversion Strategy

**For all DATETIME → TIMESTAMPTZ migrations:**

1. **Read Django datetime** (naive, assumed KST)
   ```python
   django_dt = user.created_at  # e.g., 2024-01-15 14:30:00
   ```

2. **Add 9 hours to convert KST → UTC**
   ```python
   from datetime import timedelta
   utc_dt = django_dt + timedelta(hours=9)
   # Result: 2024-01-15 23:30:00 UTC
   ```

3. **Store as TIMESTAMPTZ in Supabase**
   ```python
   supabase.table('profiles').insert({
       'created_at': utc_dt.isoformat() + 'Z'  # ISO 8601 with Z suffix
   })
   ```

### Verification
After migration, verify timezone conversion:
```sql
-- Supabase SQL
SELECT 
  id,
  created_at AT TIME ZONE 'Asia/Seoul' as kst_time,
  created_at AT TIME ZONE 'UTC' as utc_time
FROM profiles
LIMIT 10;
```

Expected: `kst_time` should match original Django datetime.

---

## Section 5: Cutover Plan (Big Bang)

### Overview
A single, coordinated migration event to switch all traffic from Django to Next.js+Supabase.

### Prerequisites
- [ ] All 15 tables successfully migrated to Supabase
- [ ] Data integrity verified (row counts, spot checks)
- [ ] Next.js app fully tested with Supabase
- [ ] User authentication flow tested end-to-end
- [ ] Rollback plan documented and tested
- [ ] Monitoring and alerting configured

### Cutover Steps

**Step 1: Export All Django Data (T-2 hours)**
- Dump all tables from MySQL to JSON files
- Verify export integrity (row counts, checksums)
- Store backups in secure location

**Step 2: Run Migration Scripts (T-1 hour)**
- Execute Python migration scripts for all 15 tables
- Migrate users with invite-based re-authentication
- Verify each table's row count matches Django

**Step 3: Data Integrity Verification (T-30 minutes)**
- Spot-check random records across all tables
- Verify foreign key relationships
- Validate timezone conversions
- Check for NULL values in required fields

**Step 4: Update DNS/Routing (T-0)**
- Update DNS to point to Next.js app
- Or update load balancer to route to Next.js
- Monitor for immediate errors

**Step 5: Monitor (T+24 hours)**
- Watch error logs and performance metrics
- Monitor user login success rate
- Check API response times
- Verify data consistency

### Rollback Trigger
If critical issues detected within 1 hour:
- Revert DNS/routing to Django
- Notify users of temporary service interruption
- Investigate root cause

---

## Section 6: Rollback Plan

### Rollback Window
**Duration:** 1 week post-cutover

### Strategy

**Phase 1: Immediate Rollback (0-1 hour)**
If critical issues detected:
1. Revert DNS/routing to Django
2. Django continues serving from MySQL
3. Supabase data is read-only (no new writes)
4. Users are notified of temporary service interruption

**Phase 2: Data Sync (1 hour - 24 hours)**
If rollback triggered:
- Any writes to Supabase during rollback window must be manually reconciled
- Identify conflicting records (created/updated after cutover)
- Merge changes back to MySQL or discard

**Phase 3: Extended Rollback (1-7 days)**
- Keep Django running in read-only mode
- Monitor Supabase for any critical issues
- Prepare for second cutover attempt

### Rollback Checklist
- [ ] Django app still running and accessible
- [ ] MySQL database intact and accessible
- [ ] DNS/routing reverted to Django
- [ ] Users notified of rollback
- [ ] Supabase data frozen (no new writes)
- [ ] Conflict resolution plan executed
- [ ] Root cause analysis completed

### Post-Rollback Actions
1. **Investigate Root Cause**
   - Review error logs
   - Identify failed migrations
   - Fix issues in Next.js or Supabase

2. **Prepare for Second Cutover**
   - Re-run migration scripts
   - Re-test all functionality
   - Update rollback plan based on lessons learned

3. **Communicate with Users**
   - Explain what happened
   - Provide timeline for next attempt
   - Offer support for any issues

---

## Appendix: Migration Checklist

### Pre-Migration
- [ ] Backup all Django/MySQL data
- [ ] Backup all Supabase data
- [ ] Test migration scripts in staging environment
- [ ] Verify all 15 tables in Supabase schema
- [ ] Configure monitoring and alerting
- [ ] Prepare rollback plan
- [ ] Notify users of planned maintenance

### During Migration
- [ ] Export Django data
- [ ] Run migration scripts
- [ ] Verify data integrity
- [ ] Test user authentication
- [ ] Test API endpoints
- [ ] Update DNS/routing
- [ ] Monitor for errors

### Post-Migration
- [ ] Verify all users can log in
- [ ] Verify all data is accessible
- [ ] Monitor error logs for 24 hours
- [ ] Collect user feedback
- [ ] Document lessons learned
- [ ] Decommission Django app (after 1 week)

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Django to Supabase Migration Guide](https://supabase.com/docs/guides/migrations)

---

**Document Status:** Complete (Plan B)  
**Next Steps:** Execute Plan C (ETL Implementation & Cutover)
