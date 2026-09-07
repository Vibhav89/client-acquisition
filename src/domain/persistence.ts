import type { ApprovalRequest } from "./approval.js";
import type { Opportunity } from "./opportunity.js";

export interface PersistencePort {
  saveOpportunity(opportunity: Opportunity): void;
  saveApproval(request: ApprovalRequest): void;
  getOpportunity(id: string): Opportunity | undefined;
  listOpportunities(): Opportunity[];
  listPendingApprovals(): ApprovalRequest[];
}

export class InMemoryPersistence implements PersistencePort {
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly approvals = new Map<string, ApprovalRequest>();

  saveOpportunity(opportunity: Opportunity): void {
    this.opportunities.set(opportunity.id, opportunity);
  }

  saveApproval(request: ApprovalRequest): void {
    if (!this.opportunities.has(request.opportunityId)) {
      throw new Error("Approval references an unknown opportunity");
    }
    this.approvals.set(request.id, request);
  }

  getOpportunity(id: string): Opportunity | undefined {
    return this.opportunities.get(id);
  }

  listOpportunities(): Opportunity[] {
    return [...this.opportunities.values()];
  }

  listPendingApprovals(): ApprovalRequest[] {
    return [...this.approvals.values()].filter((request) => request.state === "pending");
  }
}
