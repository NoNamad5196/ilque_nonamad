create extension if not exists pgcrypto;

-- This starter uses the NextAuth session subject as the application user id.
-- If you later switch to Supabase Auth directly, convert the id columns to uuid
-- and replace requesting_user_id() with auth.uid().

create or replace function public.requesting_user_id()
returns text
language sql
stable
as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '');
$$;

create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  avatar_url text,
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  last_completed_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  quest_title text not null,
  category text not null check (category in ('sql', 'coding', 'study', 'review')),
  xp_earned integer not null default 0,
  completed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weekly_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  week_date date not null,
  completed boolean not null default false
);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  category text not null,
  start_date date not null,
  end_date date not null,
  daily_hours numeric(4, 2) not null default 2,
  level text not null,
  plan_json jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quest_completions_user_completed_at
  on public.quest_completions(user_id, completed_at desc);

create index if not exists idx_weekly_progress_user_week_date
  on public.weekly_progress(user_id, week_date);

create index if not exists idx_user_goals_user_active
  on public.user_goals(user_id, is_active);

alter table public.users enable row level security;
alter table public.quest_completions enable row level security;
alter table public.weekly_progress enable row level security;
alter table public.user_goals enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  using (public.requesting_user_id() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  using (public.requesting_user_id() = id)
  with check (public.requesting_user_id() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users
  for insert
  with check (public.requesting_user_id() = id);

drop policy if exists "quest_select_own" on public.quest_completions;
create policy "quest_select_own"
  on public.quest_completions
  for select
  using (public.requesting_user_id() = user_id);

drop policy if exists "quest_insert_own" on public.quest_completions;
create policy "quest_insert_own"
  on public.quest_completions
  for insert
  with check (public.requesting_user_id() = user_id);

drop policy if exists "quest_update_own" on public.quest_completions;
create policy "quest_update_own"
  on public.quest_completions
  for update
  using (public.requesting_user_id() = user_id)
  with check (public.requesting_user_id() = user_id);

drop policy if exists "quest_delete_own" on public.quest_completions;
create policy "quest_delete_own"
  on public.quest_completions
  for delete
  using (public.requesting_user_id() = user_id);

drop policy if exists "weekly_select_own" on public.weekly_progress;
create policy "weekly_select_own"
  on public.weekly_progress
  for select
  using (public.requesting_user_id() = user_id);

drop policy if exists "weekly_insert_own" on public.weekly_progress;
create policy "weekly_insert_own"
  on public.weekly_progress
  for insert
  with check (public.requesting_user_id() = user_id);

drop policy if exists "weekly_update_own" on public.weekly_progress;
create policy "weekly_update_own"
  on public.weekly_progress
  for update
  using (public.requesting_user_id() = user_id)
  with check (public.requesting_user_id() = user_id);

drop policy if exists "weekly_delete_own" on public.weekly_progress;
create policy "weekly_delete_own"
  on public.weekly_progress
  for delete
  using (public.requesting_user_id() = user_id);

drop policy if exists "goals_select_own" on public.user_goals;
create policy "goals_select_own"
  on public.user_goals
  for select
  using (public.requesting_user_id() = user_id);

drop policy if exists "goals_insert_own" on public.user_goals;
create policy "goals_insert_own"
  on public.user_goals
  for insert
  with check (public.requesting_user_id() = user_id);

drop policy if exists "goals_update_own" on public.user_goals;
create policy "goals_update_own"
  on public.user_goals
  for update
  using (public.requesting_user_id() = user_id)
  with check (public.requesting_user_id() = user_id);

drop policy if exists "goals_delete_own" on public.user_goals;
create policy "goals_delete_own"
  on public.user_goals
  for delete
  using (public.requesting_user_id() = user_id);
