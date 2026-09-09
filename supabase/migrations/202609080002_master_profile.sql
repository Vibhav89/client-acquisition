alter table public.profiles
  add column if not exists master_profile jsonb;

create index if not exists profiles_updated_idx on public.profiles(updated_at desc);
