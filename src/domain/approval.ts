export type ApprovalState = "draft" | "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  opportunityId: string;
  proposal: string;
  state: ApprovalState;
  createdAt: string;
  decidedAt?: string;
}

const transitions: Record<ApprovalState, readonly ApprovalState[]> = {
  draft: ["pending", "rejected"],
  pending: ["approved", "rejected", "expired"],
  approved: [],
  rejected: [],
  expired: [],
};

export class InvalidApprovalTransitionError extends Error {
  readonly code = "INVALID_APPROVAL_TRANSITION" as const;
  constructor(fromState: ApprovalState, toState: ApprovalState) {
    super(`Invalid approval transition: ${fromState} -> ${toState}`);
    this.name = "InvalidApprovalTransitionError";
  }
}

export function transitionApproval(request: ApprovalRequest, next: ApprovalState, now = new Date().toISOString()): ApprovalRequest {
  if (!transitions[request.state].includes(next)) {
    throw new InvalidApprovalTransitionError(request.state, next);
  }
  return {
    ...request,
    state: next,
    ...(next === "approved" || next === "rejected" || next === "expired" ? { decidedAt: now } : {}),
  };
}
