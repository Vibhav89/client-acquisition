-- Migration for Document and Resume Vault Persistence
create table if not exists public.documents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  document_type text not null default 'general',
  file_name text not null,
  file_type text not null default 'txt',
  file_size_bytes integer not null default 0,
  content_text text not null default '',
  skills jsonb not null default '[]'::jsonb,
  target_role text,
  version text not null default '1.0',
  status text not null default 'active' check (status in ('active', 'archived', 'processing', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists documents_user_type_idx on public.documents(user_id, document_type);

-- RLS Configuration
alter table public.documents enable row level security;

drop policy if exists "documents_owner_all" on public.documents;
create policy "documents_owner_all" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
