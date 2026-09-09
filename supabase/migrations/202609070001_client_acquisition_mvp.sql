create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  skills jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  preferred_work_modes text[] not null default '{}',
  minimum_hourly_usd numeric(12,2),
  minimum_fixed_usd numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists minimum_fixed_usd numeric(12,2);

create table if not exists public.opportunities (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_url text not null,
  title text not null,
  description text not null,
  skills jsonb not null default '[]'::jsonb,
  work_mode text not null default 'unknown' check (work_mode in ('remote','hybrid','onsite','unknown')),
  location text,
  budget jsonb,
  client jsonb,
  status text not null default 'new' check (status in ('new','qualified','skipped','approved','applied')),
  discovered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_url)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  subject text not null,
  body text not null,
  personalization jsonb not null default '[]'::jsonb,
  claims_used jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  proposal text not null,
  state text not null default 'draft' check (state in ('draft','pending','approved','rejected','expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists opportunities_user_status_idx on public.opportunities(user_id, status);
create index if not exists opportunities_discovered_idx on public.opportunities(user_id, discovered_at desc);
create index if not exists approvals_user_state_idx on public.approval_requests(user_id, state);

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.proposals enable row level security;
alter table public.approval_requests enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists "opportunities_owner_all" on public.opportunities;
drop policy if exists "proposals_owner_all" on public.proposals;
drop policy if exists "approvals_owner_all" on public.approval_requests;

create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "opportunities_owner_all" on public.opportunities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "proposals_owner_all" on public.proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "approvals_owner_all" on public.approval_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
