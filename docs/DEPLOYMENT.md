# Deployment checklist

## 1. Supabase

- Create a Supabase project.
- Apply `supabase/migrations/202609070001_client_acquisition_mvp.sql`.
- Enable email/password authentication if using the included sign-in UI.
- Do not expose or configure a Supabase service-role key in this application.

## 2. Application environment

Set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT` (optional; defaults to the server configuration)

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
