# Repository Interface Specifications

> Architecture Decision Document for Plan B+
> These are SPECIFICATIONS (prose + pseudocode), not TypeScript implementations.
> Actual TypeScript interfaces will be implemented in Plan B.

## Design Principles

1. **Abstraction**: Interfaces hide whether data comes from Supabase, cache, or API
2. **Testability**: Easy to mock for unit tests
3. **Type Safety**: All return types explicitly defined
4. **Error Handling**: Throws typed errors, never returns null silently

---

## 1. IAuthRepository

**Purpose**: All authentication operations

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `signInWithOAuth(provider)` | 'kakao' \| 'google' \| 'apple' | void (redirect) | Initiates OAuth flow |
| `signInWithPassword(email, password)` | string, string | Session | Password login (testing/admin) |
| `signOut(scope?)` | 'local' \| 'global' | void | Signs out user |
| `getUser()` | — | User \| null | Gets currently authenticated user |
| `getSession()` | — | Session \| null | Gets current session with tokens |
| `refreshSession()` | — | Session | Refreshes expired access token |
| `onAuthStateChange(callback)` | (User\|null) => void | Unsubscribe fn | Subscribe to auth events |

**Notes**:
- `signOut({scope: 'global'})` replaces Django's `token_version` invalidation
- OAuth redirect goes through `/auth/callback` route

---

## 2. IScheduleRepository

**Purpose**: Bible reading schedule management

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getScheduleByDate(date)` | Date | DailySchedule \| null | Get schedule for specific date |
| `getSchedulesForPlan(planId, start, end)` | number, Date, Date | DailySchedule[] | Date range query |
| `getCurrentSchedule()` | — | DailySchedule \| null | Today's schedule |
| `getScheduleById(id)` | string | DailySchedule \| null | Direct lookup |

**DailySchedule shape**: `{ id, planId, date, book, chapter, createdAt }`

---

## 3. IProgressRepository

**Purpose**: User reading progress tracking (RLS-protected)

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getProgress(subscriptionId, scheduleId)` | string, string | UserProgress \| null | Single progress record |
| `markComplete(subscriptionId, scheduleId)` | string, string | UserProgress | Mark as completed |
| `markIncomplete(subscriptionId, scheduleId)` | string, string | UserProgress | Unmark completion |
| `getProgressForSubscription(subscriptionId)` | string | UserProgress[] | All progress for a plan |
| `getProgressSummary(subscriptionId)` | string | ProgressSummary | Stats: total, completed, streak |
| `bulkGetProgress(subscriptionId, scheduleIds)` | string, string[] | UserProgress[] | Batch fetch |

**Notes**:
- All methods automatically filter by auth.uid() via RLS (FK chain pattern)
- `ProgressSummary`: `{ totalDays, completedDays, currentStreak, longestStreak }`

---

## 4. IPlanRepository

**Purpose**: Bible reading plans and subscriptions

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getAvailablePlans()` | — | BibleReadingPlan[] | All active plans |
| `getPlanById(planId)` | number | BibleReadingPlan | Single plan |
| `subscribeToPlan(planId)` | number | PlanSubscription | Subscribe user to plan |
| `unsubscribeFromPlan(subscriptionId)` | string | void | Unsubscribe |
| `getUserSubscriptions()` | — | PlanSubscription[] | Current user's subscriptions |
| `getSubscriptionById(id)` | string | PlanSubscription \| null | Single subscription |

---

## 5. IProfileRepository

**Purpose**: User profile management (RLS: owner only)

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getProfile(userId?)` | string? | UserProfile | Get profile (own if no userId) |
| `updateProfile(data)` | Partial<UserProfile> | UserProfile | Update own profile |
| `updatePublicStatus(isPublic)` | boolean | void | Toggle profile visibility |
| `getPublicProfiles(limit?)` | number? | UserProfile[] | Public profiles for leaderboard |

---

## 6. IHasenaRepository

**Purpose**: 하세나하시조 video content

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getVideoByDate(date)` | Date | HasenaVideo \| null | Video for specific date |
| `getRecentVideos(limit)` | number | HasenaVideo[] | Recent videos |
| `getVideoById(videoId)` | string | HasenaVideo \| null | Direct lookup |
| `getTodayVideo()` | — | HasenaVideo \| null | Convenience method |

**HasenaVideo shape**: `{ id, date, youtubeUrl, title, description, type: 'daily' | 'sunday' }`

---

## 7. IBibleRepository

**Purpose**: Bible text content (cached)

| Method | Input | Returns | Description |
|--------|-------|---------|-------------|
| `getBibleText(book, chapter, language)` | string, number, string | BibleContent \| null | Get chapter text |
| `cacheBibleText(book, chapter, language, content)` | string, number, string, string | void | Store in cache |
| `getAvailableLanguages()` | — | string[] | Languages with cached content |
| `getAvailableBooks(language)` | string | string[] | Books available for language |

**Notes**:
- Korean (`ko`) content from migrated database
- Other languages fetched from API.Bible on demand, cached on first access
- Server-side only for non-Korean (API key protection)

---

## Implementation Notes for Plan B

1. Each interface implemented as a class: `SupabaseAuthRepository implements IAuthRepository`
2. Use Supabase client from `lib/supabase/client.ts` (browser) or `lib/supabase/server.ts` (server)
3. Repository instances injected via React Context or direct import
4. Error types: `AuthError`, `NotFoundError`, `PermissionError`, `NetworkError`
