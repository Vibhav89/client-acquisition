import { transitionApproval, type ApprovalRequest } from "../domain/approval.js";
import type { RadarResult } from "../domain/radar.js";
import { sanitizeProposalInput } from "../domain/security.js";
import type { PersistencePort } from "../domain/persistence.js";

export interface ApprovalService {
  createForRadar(result: RadarResult, now?: string): ApprovalRequest[];
  approve(id: string, now?: string): ApprovalRequest;
  reject(id: string, now?: string): ApprovalRequest;
}

export class DefaultApprovalService implements ApprovalService {
  constructor(private readonly persistence: PersistencePort) {}

  createForRadar(result: RadarResult, now = new Date().toISOString()): ApprovalRequest[] {
    const created: ApprovalRequest[] = [];
    for (const ranked of result.ranked) {
      if (ranked.analysis.recommendation !== "apply") continue;

      const existing = this.persistence.listPendingApprovals().find(
        (request) => request.opportunityId === ranked.opportunity.id,
      );
      if (existing) {
        created.push(existing);
        continue;
      }

      const request: ApprovalRequest = {
        id: `approval:${ranked.opportunity.id}`,
        opportunityId: ranked.opportunity.id,
        proposal: sanitizeProposalInput(
          `Application: ${ranked.opportunity.title}\n\n${buildApprovalBody(ranked.opportunity.id, ranked.analysis.match.matchedSkills)}`,
        ),
        state: "draft",
        createdAt: now,
      };
      const pending = transitionApproval(request, "pending", now);
      this.persistence.saveApproval(pending);
      created.push(pending);
    }
    return created;
  }

  approve(id: string, now = new Date().toISOString()): ApprovalRequest {
    const request = this.findPending(id);
    const approved = transitionApproval(request, "approved", now);
    this.persistence.saveApproval(approved);
    return approved;
  }

  reject(id: string, now = new Date().toISOString()): ApprovalRequest {
    const request = this.findPending(id);
    const rejected = transitionApproval(request, "rejected", now);
    this.persistence.saveApproval(rejected);
    return rejected;
  }

  private findPending(id: string): ApprovalRequest {
    const request = this.persistence.listPendingApprovals().find((item) => item.id === id);
    if (!request) throw new Error(`Pending approval not found: ${id}`);
    return request;
  }
}

function buildApprovalBody(opportunityId: string, matchedSkills: readonly string[]): string {
  return [
    `Opportunity: ${opportunityId}`,
    `Matched skills: ${matchedSkills.join(", ") || "None"}`,
    "Human review required before any external submission.",
  ].join("\n");
}
