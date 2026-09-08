create table if not exists public.event_history (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  timestamp timestamptz not null,
  entity_type text not null,
  entity_id text not null,
  source text,
  summary text not null,
  metadata jsonb,
  requires_user_approval boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists event_history_user_timestamp_idx
  on public.event_history (user_id, timestamp desc);

create index if not exists event_history_user_entity_idx
  on public.event_history (user_id, entity_type, entity_id, timestamp desc);

alter table public.event_history enable row level security;

drop policy if exists "event_history_owner_select" on public.event_history;
drop policy if exists "event_history_owner_insert" on public.event_history;
drop policy if exists "event_history_owner_update" on public.event_history;
drop policy if exists "event_history_owner_delete" on public.event_history;

create policy "event_history_owner_select"
  on public.event_history for select
  using (auth.uid() = user_id);

create policy "event_history_owner_insert"
  on public.event_history for insert
  with check (auth.uid() = user_id);

create policy "event_history_owner_update"
  on public.event_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "event_history_owner_delete"
  on public.event_history for delete
  using (auth.uid() = user_id);
