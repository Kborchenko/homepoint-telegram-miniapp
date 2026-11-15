create extension if not exists pgcrypto;

create type public.assessment_status as enum ('idle', 'active', 'completed', 'expired');
create type public.access_status as enum ('locked', 'pending', 'granted', 'revoked');

create table public.candidate_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_id bigint unique not null,
  username text,
  first_name text not null,
  last_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidate_profiles(id) on delete cascade,
  status public.assessment_status not null default 'idle',
  started_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  score integer check (score between 0 and 100),
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (expires_at is null or started_at is not null),
  check (expires_at is null or expires_at = started_at + interval '24 hours')
);

create table public.academy_access (
  candidate_id uuid primary key references public.candidate_profiles(id) on delete cascade,
  status public.access_status not null default 'locked',
  requested_at timestamptz,
  granted_at timestamptz,
  granted_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.training_progress (
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 7),
  status text not null default 'locked' check (status in ('locked', 'available', 'active', 'completed')),
  opened_at timestamptz,
  completed_at timestamptz,
  score integer check (score between 0 and 100),
  progress jsonb not null default '{}'::jsonb,
  primary key (candidate_id, day_number)
);

create table public.reference_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  file_url text,
  content jsonb not null default '{}'::jsonb,
  day_number smallint check (day_number between 1 and 7),
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager', false)
$$;

create or replace function public.start_assessment()
returns public.assessment_sessions
language plpgsql security definer set search_path = '' as $$
declare result public.assessment_sessions;
begin
  insert into public.assessment_sessions(candidate_id, status, started_at, expires_at)
  values (auth.uid(), 'active', now(), now() + interval '24 hours')
  on conflict (candidate_id) do update
    set status = case when assessment_sessions.status = 'idle' then 'active' else assessment_sessions.status end,
        started_at = coalesce(assessment_sessions.started_at, now()),
        expires_at = coalesce(assessment_sessions.expires_at, now() + interval '24 hours'),
        updated_at = now()
  returning * into result;
  return result;
end $$;

create or replace function public.request_academy_access()
returns public.academy_access
language plpgsql security definer set search_path = '' as $$
declare result public.academy_access;
begin
  if not exists(select 1 from public.assessment_sessions where candidate_id = auth.uid() and status = 'completed') then
    raise exception 'Assessment must be completed first';
  end if;
  insert into public.academy_access(candidate_id, status, requested_at)
  values(auth.uid(), 'pending', now())
  on conflict(candidate_id) do update set status = 'pending', requested_at = now(), updated_at = now()
  returning * into result;
  return result;
end $$;

create or replace function public.grant_academy_access(target_candidate uuid, allow_access boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  insert into public.academy_access(candidate_id, status, granted_at, granted_by)
  values(target_candidate, case when allow_access then 'granted'::public.access_status else 'revoked'::public.access_status end, case when allow_access then now() end, auth.uid())
  on conflict(candidate_id) do update set status = excluded.status, granted_at = excluded.granted_at, granted_by = auth.uid(), updated_at = now();
end $$;

alter table public.candidate_profiles enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.academy_access enable row level security;
alter table public.training_progress enable row level security;
alter table public.reference_materials enable row level security;

create policy "candidate reads own profile" on public.candidate_profiles for select using (id = auth.uid() or public.is_manager());
create policy "candidate updates own profile" on public.candidate_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "candidate reads own assessment" on public.assessment_sessions for select using (candidate_id = auth.uid() or public.is_manager());
create policy "candidate reads own access" on public.academy_access for select using (candidate_id = auth.uid() or public.is_manager());
create policy "candidate reads own training" on public.training_progress for select using (candidate_id = auth.uid() or public.is_manager());
create policy "candidate updates own training" on public.training_progress for update using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy "granted candidates read references" on public.reference_materials for select using (
  published and exists(select 1 from public.academy_access where candidate_id = auth.uid() and status = 'granted')
  or public.is_manager()
);

grant execute on function public.start_assessment() to authenticated;
grant execute on function public.request_academy_access() to authenticated;
grant execute on function public.grant_academy_access(uuid, boolean) to authenticated;

