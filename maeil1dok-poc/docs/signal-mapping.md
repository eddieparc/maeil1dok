# Django Signal → Supabase Migration Mapping

> Architecture Decision Document for Plan B+
> Based on Plan A spike results (2026-02-25)

## Overview

The Django backend uses 4 signals (2 in `accounts/signals.py`, 2 in `todos/signals.py`). This document maps each to its Supabase equivalent.

---

## Signal #1: User Created → UserProfile Auto-Creation

**Source**: `backend/accounts/signals.py`
```python
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance, ...)
```

**Supabase Equivalent**: PostgreSQL Trigger (IMPLEMENTED AND VERIFIED IN T4 SPIKE)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Status**: ✅ VERIFIED — T4 spike confirmed trigger fires immediately on user creation
**Complexity**: LOW
**Approach**: PostgreSQL trigger (already in migration `20260224000000_representative_tables.sql`)

---

## Signal #2: User Saved → Profile Cascade Save

**Source**: `backend/accounts/signals.py`
```python
@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
```

**Supabase Equivalent**: NOT NEEDED

**Reasoning**: This signal exists because Django's `UserProfile` is a OneToOne related model that requires explicit `.save()` when the parent User is saved. In Supabase:
- `profiles` is an independent table with its own REST endpoint
- Profile updates go directly to `/rest/v1/profiles` with PATCH
- No cascade save needed — updates are explicit

**Status**: ✅ NO ACTION REQUIRED
**Complexity**: N/A
**Approach**: Remove from architecture — Supabase's data model eliminates the need

---

## Signal #3: PlanSubscription Created → DisplaySettings Auto-Creation

**Source**: `backend/todos/signals.py`
```python
@receiver(post_save, sender=PlanSubscription)
def create_display_settings(sender, instance, created, **kwargs):
    if created:
        existing_count = UserPlanDisplaySettings.objects.filter(user=instance.user).count()
        UserPlanDisplaySettings.objects.create(
            user=instance.user, subscription=instance,
            color=PLAN_COLORS[existing_count % len(PLAN_COLORS)],
            display_order=existing_count
        )
```

**Supabase Equivalent**: PostgreSQL Trigger (READY TO IMPLEMENT)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  colors TEXT[] := ARRAY['blue', 'green', 'orange', 'purple', 'pink'];
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM public.plan_display_settings WHERE user_id = NEW.user_id;
  
  INSERT INTO public.plan_display_settings (user_id, subscription_id, color, display_order)
  VALUES (NEW.user_id, NEW.id, colors[(existing_count % 5) + 1], existing_count);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_subscription_created
  AFTER INSERT ON public.plan_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_subscription();
```

**Status**: 🔵 READY TO IMPLEMENT in Plan B
**Complexity**: LOW
**Approach**: PostgreSQL trigger (same pattern as Signal #1)

---

## Signal #4: UserBibleProgress → Achievement + Stats Update (MOST COMPLEX)

**Source**: `backend/todos/signals.py`
```python
@receiver(post_save, sender=UserBibleProgress)
def update_stats_and_achievements(sender, instance, **kwargs):
    if instance.is_completed:
        user = instance.subscription.user
        AchievementService.update_user_stats(user)       # streak, total_days
        AchievementService.check_and_grant_achievements(user)  # 10+ achievement types
```

**Referenced Service**: `backend/accounts/services/achievement_service.py` (223 lines)
- `update_user_stats()`: recalculates total_completed_days, current_streak, longest_streak
- `check_and_grant_achievements()`: checks 10+ achievement types (첫완독, 연속, 권별, 전체통독 등)

**Complexity Analysis**:
- Stats calculation: MEDIUM → convertible to PostgreSQL function
- Achievement checks: HIGH → complex cross-table queries, conditional logic → Edge Function

**Supabase Approach**:
| Component | Approach | Reason |
|-----------|----------|--------|
| Stats (streak, total_days) | PostgreSQL function | Pure SQL aggregation |
| Achievement system | **EXCLUDED from v1** | Too complex, separate iteration |

**v1 Implementation Plan**:
```sql
-- Stats update via PostgreSQL function (called from trigger)
CREATE OR REPLACE FUNCTION public.update_user_stats(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles SET
    total_completed_days = (
      SELECT COUNT(DISTINCT up.id) 
      FROM user_progress up
      JOIN plan_subscriptions ps ON ps.id = up.subscription_id
      WHERE ps.user_id = p_user_id AND up.is_completed = true
    ),
    -- streak calculation TBD in Plan B
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Status**: ⚠️ PARTIAL — Stats only in v1, Achievement system deferred to later plan
**Complexity**: HIGH (achievement), MEDIUM (stats)
**Guardrail**: ❌ Full achievement system implementation excluded from v1

---

## Summary Table

| Signal | Django Pattern | Supabase Equivalent | Status |
|--------|---------------|---------------------|--------|
| #1 User→Profile | post_save trigger | PostgreSQL trigger | ✅ DONE |
| #2 Profile cascade | post_save cascade | Not needed | ✅ N/A |
| #3 Subscription→Display | post_save trigger | PostgreSQL trigger | 🔵 Plan B |
| #4 Progress→Achievement | post_save + service | PostgreSQL fn (stats only) + Edge Fn (achievements, deferred) | ⚠️ Partial |
