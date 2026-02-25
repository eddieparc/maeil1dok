-- Representative tables for RLS spike (Plan A validation)
-- 4 tables mirroring key Django models

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. profiles (mirrors Django UserProfile)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  nickname text,
  total_completed_days integer default 0,
  current_streak integer default 0,
  longest_streak integer default 0,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. plan_subscriptions (mirrors Django PlanSubscription)
create table public.plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id integer not null default 1,
  subscribed_at timestamptz default now()
);

-- 3. daily_schedules (mirrors Django DailyBibleSchedule - PUBLIC read)
create table public.daily_schedules (
  id uuid primary key default gen_random_uuid(),
  plan_id integer not null,
  date date not null,
  book text not null,
  chapter integer not null,
  created_at timestamptz default now()
);

-- 4. user_progress (mirrors Django UserBibleProgress - FK chain)
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.plan_subscriptions(id) on delete cascade not null,
  schedule_id uuid references public.daily_schedules(id) on delete cascade not null,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== RLS POLICIES =====
alter table public.profiles enable row level security;
alter table public.plan_subscriptions enable row level security;
alter table public.daily_schedules enable row level security;
alter table public.user_progress enable row level security;

-- profiles: owner only
create policy "profiles_owner_only" on public.profiles
  for all using (auth.uid() = user_id);

-- plan_subscriptions: owner only
create policy "subscriptions_owner_only" on public.plan_subscriptions
  for all using (auth.uid() = user_id);

-- daily_schedules: authenticated users can read
create policy "schedules_authenticated_read" on public.daily_schedules
  for select using (auth.role() = 'authenticated');

-- user_progress: FK chain pattern (user must own the subscription)
create policy "progress_via_subscription_owner" on public.user_progress
  for all using (
    auth.uid() = (
      select user_id from public.plan_subscriptions
      where id = subscription_id
    )
  );

-- ===== INDEXES for RLS performance =====
create index idx_subscriptions_user_id on public.plan_subscriptions(user_id);
create index idx_progress_subscription_id on public.user_progress(subscription_id);

-- ===== AUTO PROFILE TRIGGER (Signal #1 equivalent) =====
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
