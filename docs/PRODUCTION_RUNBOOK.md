# Production runbook

## Required external setup

1. Create a Supabase project and enable email/password authentication.
2. Apply `supabase/migrations/202609070001_client_acquisition_mvp.sql`.
3. Create a normal application user in Supabase Auth.
4. Deploy this repository with `npm start`.
5. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PORT` as deployment environment variables.
6. Use HTTPS at the hosting layer.

## Smoke test

- `GET /api/health` returns `ok: true` and reports `supabase` authentication.
- `GET /api/config` reports `supabase` and never returns a service-role secret.
- Radar without a bearer token returns HTTP 401.
- Sign in through the UI and run the radar.
- Verify opportunities are persisted for the signed-in user.
- Verify only matching, acceptable-risk opportunities receive proposal drafts.
- Verify proposals remain pending until explicit approval.
- Verify approving/rejecting an approval changes its terminal state and cannot be changed again.
- Verify a second user cannot read the first user's opportunities or approvals (RLS).
- Verify no automatic external application or message is sent.

## Operational checks

- Keep credentials out of Git and client-side source control.
- Use only the Supabase anon/publishable key; never use a service-role key in the app.
- Review source terms before adding a new job feed.
- Preserve the original opportunity URL when presenting an opportunity.
- Treat source failures as isolated feed failures rather than failing the whole radar.
