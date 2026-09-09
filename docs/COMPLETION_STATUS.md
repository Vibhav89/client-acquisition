# Completion status

## Complete in repository

- Opportunity domain, normalization, matching, risk scoring, ranking and radar orchestration
- Canonical URL/tracking-parameter deduplication
- Evidence-grounded proposal drafting
- Explicit approval state machine with terminal-state protection
- In-memory persistence and Supabase persistence
- Supabase owner-scoped queries and RLS migration
- React dashboard and same-origin Node API
- Email/password sign-in integration
- Remote OK and Remotive source adapters
- Per-source failure isolation and 15-second source timeout
- URL/proposal security helpers
- Unit and hardening tests
- Typecheck/build/test CI quality gate
- Production configuration and runbook documentation

## Requires external account configuration

A real Supabase project and a hosting provider are required to perform the final live deployment. This repository intentionally contains no credentials. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PORT` in the deployment environment.

## Human approval boundary

The system prepares and ranks opportunities and drafts proposals, but it does not automatically submit applications, send messages, bypass platform controls, or use automation to evade site rules. Any future application connector must use the platform's permitted API/action mechanism and remain behind explicit user approval.
