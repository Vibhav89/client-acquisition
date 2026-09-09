# Command Center Orchestration

The command center is the user-facing decision layer for the personal client acquisition agent.

## Action rules

- Pending approvals are always surfaced first and require explicit user approval.
- `replied`, `conversation`, and `negotiation` clients produce reply actions that require approval.
- Follow-up actions are created only when the follow-up policy says they are due; they are not created merely because a client is in an older stage.
- `final_approval` produces a deal-review action and remains behind the user approval boundary.
- Strong opportunities can produce apply actions, but the application itself is never submitted automatically by this layer.

This keeps discovery and analysis autonomous while preserving an explicit approval boundary for consequential communication, applications, contracts, payments, and commitments.
