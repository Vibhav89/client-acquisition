# Deployment checklist

## 1. Supabase

- Create a Supabase project.
- Apply all SQL migrations in `supabase/migrations/` in chronological order:
  1. `202609070001_client_acquisition_mvp.sql`
  2. `202609080002_master_profile.sql`
  3. `20260908100000_event_history.sql`
  4. `20260909000000_workflow_and_event_history.sql`
  5. `20260909100000_documents_and_resumes.sql`
  6. `20260910120000_tenant_relationship_constraints.sql`
  7. `20260910130000_approval_proposal_tenant_constraint.sql`
  8. `20260910140000_workflow_foreign_key_indexes.sql`
- Enable email/password authentication if using the included sign-in UI.
- Do not expose or configure a Supabase service-role key in this application.

## 2. Application environment

Set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT` (optional; defaults to `8787` in `src/server.ts`)
- `CLIENT_RADAR_API_TARGET` (optional for local Vite dev proxy; defaults to `http://localhost:8787`)

The browser may receive the Supabase URL and anon/publishable key. The server uses the user's bearer token for request-scoped data access.

## 3. Verification

Run:

```bash
npm install
npm run typecheck
npm run build
npm test
npm start
```

Then verify `/api/health`, sign in, run the radar, and confirm that pending proposals require an explicit approval action. No external proposal/message is sent automatically.

## 4. Production boundary

Use HTTPS in production, configure the deployment platform's secret environment variables, and restrict access to the application as appropriate. Keep the repository's main/live application separate from this project.
