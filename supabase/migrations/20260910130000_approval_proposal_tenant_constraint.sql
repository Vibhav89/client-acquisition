-- Close the remaining tenant-consistency gap for approval-to-proposal links.
-- proposal_id is globally unique today, but the composite constraint makes
-- the owning user part of the relationship as well.

create unique index if not exists proposals_user_id_id_uidx
  on public.proposals (user_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'approval_requests_user_proposal_fk'
      and conrelid = 'public.approval_requests'::regclass
  ) then
    alter table public.approval_requests
      add constraint approval_requests_user_proposal_fk
      foreign key (user_id, proposal_id)
      references public.proposals (user_id, id)
      on delete set null (proposal_id) not valid;
  end if;
end $$;
