-- Supporting indexes for tenant-scoped foreign keys and common workflow queries.
-- PostgreSQL does not automatically index referencing (child) FK columns.

create index if not exists proposals_user_opportunity_idx
  on public.proposals (user_id, opportunity_id);

create index if not exists approval_requests_user_opportunity_idx
  on public.approval_requests (user_id, opportunity_id);

create index if not exists approval_requests_user_proposal_idx
  on public.approval_requests (user_id, proposal_id)
  where proposal_id is not null;

create index if not exists conversations_user_client_timestamp_idx
  on public.conversations (user_id, client_id, timestamp);

create index if not exists deals_user_client_created_idx
  on public.deals (user_id, client_id, created_at desc);

create index if not exists applications_user_client_idx
  on public.applications (user_id, client_id)
  where client_id is not null;

create index if not exists applications_user_opportunity_idx
  on public.applications (user_id, opportunity_id);

create index if not exists earnings_user_client_idx
  on public.earnings (user_id, client_id)
  where client_id is not null;

create index if not exists earnings_user_application_idx
  on public.earnings (user_id, application_id)
  where application_id is not null;

create index if not exists learning_events_user_client_created_idx
  on public.learning_events (user_id, client_id, created_at desc)
  where client_id is not null;

create index if not exists learning_events_user_opportunity_created_idx
  on public.learning_events (user_id, opportunity_id, created_at desc)
  where opportunity_id is not null;
