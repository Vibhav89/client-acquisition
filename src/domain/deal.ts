export type DealState = "draft" | "pending_final_approval" | "approved" | "rejected" | "won" | "lost";

export interface DealTerms {
  scope: string;
  priceUsd: number;
  deliveryDays: number;
  deliverables: string[];
  assumptions: string[];
  risks: string[];
  paymentTerms?: string | undefined;
}

export interface DealApproval {
  id: string;
  clientId: string;
  state: DealState;
  terms: DealTerms;
  rationale: string[];
  createdAt: string;
  decidedAt?: string | undefined;
}

const transitions: Record<DealState, readonly DealState[]> = {
  draft: ["pending_final_approval", "rejected"],
  pending_final_approval: ["approved", "rejected"],
  approved: ["won", "lost"],
  rejected: [],
  won: [],
  lost: [],
};

export function transitionDealApproval(deal: DealApproval, next: DealState, now = new Date().toISOString()): DealApproval {
  if (!transitions[deal.state].includes(next)) throw new Error(`Invalid deal transition: ${deal.state} -> ${next}`);
  return { ...deal, state: next, ...(next === "approved" || next === "rejected" ? { decidedAt: now } : {}) };
}
