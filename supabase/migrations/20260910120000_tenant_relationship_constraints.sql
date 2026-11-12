-- Enforce tenant-consistent relationships for workflow records.
-- NOT VALID avoids blocking deployment on legacy rows while enforcing the
-- constraint for every new or updated row. Existing rows can be validated
-- separately after any legacy inconsistencies have been reviewed.

create unique index if not exists opportunities_user_id_id_uidx
  on public.opportunities (user_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proposals_user_opportunity_fk') then
    alter table public.proposals
      add constraint proposals_user_opportunity_fk
      foreign key (user_id, opportunity_id)
      references public.opportunities (user_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'approval_requests_user_opportunity_fk') then
    alter table public.approval_requests
      add constraint approval_requests_user_opportunity_fk
      foreign key (user_id, opportunity_id)
      references public.opportunities (user_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conversations_user_client_fk') then
    alter table public.conversations
      add constraint conversations_user_client_fk
      foreign key (user_id, client_id)
      references public.clients (user_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'deals_user_client_fk') then
    alter table public.deals
      add constraint deals_user_client_fk
      foreign key (user_id, client_id)
      references public.clients (user_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'applications_user_client_fk') then
    alter table public.applications
      add constraint applications_user_client_fk
      foreign key (user_id, client_id)
      references public.clients (user_id, id)
      on delete set null (client_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'applications_user_opportunity_fk') then
    alter table public.applications
      add constraint applications_user_opportunity_fk
      foreign key (user_id, opportunity_id)
      references public.opportunities (user_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'earnings_user_client_fk') then
    alter table public.earnings
      add constraint earnings_user_client_fk
      foreign key (user_id, client_id)
      references public.clients (user_id, id)
      on delete set null (client_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'earnings_user_application_fk') then
    alter table public.earnings
      add constraint earnings_user_application_fk
      foreign key (user_id, application_id)
      references public.applications (user_id, id)
      on delete set null (application_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'learning_events_user_client_fk') then
    alter table public.learning_events
      add constraint learning_events_user_client_fk
      foreign key (user_id, client_id)
      references public.clients (user_id, id)
      on delete set null (client_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'learning_events_user_opportunity_fk') then
    alter table public.learning_events
      add constraint learning_events_user_opportunity_fk
      foreign key (user_id, opportunity_id)
      references public.opportunities (user_id, id)
      on delete set null (opportunity_id) not valid;
  end if;
end $$;
