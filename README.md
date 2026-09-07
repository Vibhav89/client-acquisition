# Client Acquisition Engine

Approval-first remote client/job acquisition system. It discovers opportunities through permitted integrations, normalizes them, scores fit against a candidate profile, detects risk, drafts evidence-grounded proposals, and places external actions behind explicit human approval.

## Current implementation

- Strongly typed opportunity domain model
- Deterministic skill/evidence/budget matching
- Scam/risk signal engine
- Evidence-grounded proposal drafting (no invented experience)
- Explicit approval state machine
- Source adapter interface with failure isolation
- Normalization and source/URL deduplication
- Radar orchestration and ranking
- Vitest unit coverage for core flows
- GitHub Actions quality gate for typecheck + tests

## Safety boundary

The MVP does **not** automatically submit proposals, send client messages, bypass platform controls, or use browser automation to evade platform rules. External actions remain human-approved and should use permitted APIs or explicit user actions.

## Architecture

```text
permitted sources
      |
      v
normalizer -> deduplication -> opportunity store
                                  |
                                  v
                           match + risk engine
                                  |
                                  v
                         ranked Client Radar
                                  |
                    +-------------+-------------+
                    |                           |
              proposal draft              skip/review
                    |
                    v
             human approval
                    |
                    v
       permitted external action (future)
```

## Development

```bash
npm install
npm run typecheck
npm test
```

External credentials and platform-specific adapters are intentionally deferred until the domain pipeline is stable and the correct API permissions are available.
