-- Migration for Client Acquisition Workflow and History Persistence

create table if not exists public.clients (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_ids jsonb not null default '[]'::jsonb,
  source text not null,
  source_url text not null,
  name text,
  country text,
  verified boolean,
  hire_rate numeric(5,2),
  total_spent numeric(12,2),
  stage text not null default 'discovered',
  fit_score integer not null default 0,
  legitimacy_score integer not null default 0,
  priority_score integer not null default 0,
  summary text not null,
  needs jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  approach_angle text not null default '',
  suggested_price_usd numeric(12,2),
  suggested_delivery_days integer,
  next_action text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.conversations (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  channel text,
  timestamp timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.deals (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  state text not null default 'draft' check (state in ('draft', 'pending_final_approval', 'approved', 'rejected', 'won', 'lost')),
  terms jsonb not null,
  rationale jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.applications (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  opportunity_id text not null,
  source text not null,
  source_url text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'applied', 'interview', 'won', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.earnings (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  application_id text,
  project_title text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  received_at timestamptz not null default now(),
  notes text,
  primary key (user_id, id)
);

create table if not exists public.learning_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  opportunity_id text,
  source text,
  outcome text not null check (outcome in ('won', 'lost', 'rejected', 'ignored')),
  stage text,
  reason text,
  match_score numeric(5,2),
  risk_score numeric(5,2),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- RLS Configuration
alter table public.clients enable row level security;
alter table public.conversations enable row level security;
alter table public.deals enable row level security;
alter table public.applications enable row level security;
alter table public.earnings enable row level security;
alter table public.learning_events enable row level security;

-- Policies for Clients
drop policy if exists "clients_owner_all" on public.clients;
create policy "clients_owner_all" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies for Conversations
drop policy if exists "conversations_owner_all" on public.conversations;
create policy "conversations_owner_all" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies for Deals
drop policy if exists "deals_owner_all" on public.deals;
create policy "deals_owner_all" on public.deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies for Applications
drop policy if exists "applications_owner_all" on public.applications;
create policy "applications_owner_all" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies for Earnings
drop policy if exists "earnings_owner_all" on public.earnings;
create policy "earnings_owner_all" on public.earnings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies for Learning Events
drop policy if exists "learning_events_owner_all" on public.learning_events;
create policy "learning_events_owner_all" on public.learning_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
