import type { ApprovalRequest } from "./approval.js";
import type { Opportunity } from "./opportunity.js";

export interface OpportunityStore {
  upsert(opportunity: Opportunity): void;
  list(): Opportunity[];
}

export class MemoryOpportunityStore implements OpportunityStore {
  private readonly items = new Map<string, Opportunity>();

  upsert(opportunity: Opportunity): void {
    this.items.set(opportunity.id, opportunity);
  }

  list(): Opportunity[] {
    return [...this.items.values()];
  }
}

export interface ApprovalStore {
  save(request: ApprovalRequest): void;
  listPending(): ApprovalRequest[];
}

export class MemoryApprovalStore implements ApprovalStore {
  private readonly items = new Map<string, ApprovalRequest>();

  save(request: ApprovalRequest): void {
    this.items.set(request.id, request);
  }

  listPending(): ApprovalRequest[] {
    return [...this.items.values()].filter((item) => item.state === "pending");
  }
}
