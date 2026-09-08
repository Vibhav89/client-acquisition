# Client Acquisition Engine

Approval-first remote client/job acquisition system. It discovers opportunities through permitted integrations, normalizes them, scores fit against a candidate profile, detects risk, drafts evidence-grounded proposals, and places external actions behind explicit human approval.

## Current implementation

- Strongly typed opportunity domain model
- Deterministic skill/evidence/budget matching
- Scam/risk signal engine
- Evidence-grounded proposal drafting (no invented experience)
- Explicit approval state machine with terminal-state protection
- Source adapter interface with per-source failure isolation
- Normalization and canonical source/URL deduplication
- Radar orchestration and ranking
- React dashboard backed by the same-origin Node API
- Supabase persistence with user-scoped queries and RLS migration
- Supabase email/password sign-in flow
- Vitest unit and hardening coverage
- GitHub Actions quality gate for typecheck + build + tests
- Production `npm start` entry point and deployment checklist

## Safety boundary

The MVP does **not** automatically submit proposals, send client messages, bypass platform controls, or use browser automation to evade platform rules. External actions remain human-approved and should use permitted APIs or explicit user actions.

## Architecture

```text
permitted sources
      |
      v
normalizer -> canonical deduplication -> opportunity store
                                      |
                                      v
                               match + risk engine
                                      |
                                      v
                              ranked Client Radar
                                      |
                         +------------+------------+
                         |                         |
                   proposal draft            skip/review
                         |
                         v
                  human approval
                         |
                         v
            permitted external action
                       (future)
```

## Local development

```bash
npm install
npm run typecheck
npm run build
npm test
npm start
```

For production configuration, apply the Supabase migration and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never use a service-role key in the browser or this application's environment. See `docs/DEPLOYMENT.md`.

## Production boundary

The codebase is deployment-ready, but a real Supabase project and hosting account are required for live deployment. Credentials are intentionally not committed to Git. Platform-specific application connectors are also kept behind the human-approval boundary until the platform's permitted API/action mechanism is configured.
