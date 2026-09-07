import { transitionApproval, type ApprovalRequest } from "../domain/approval.js";
import { draftProposal } from "../domain/proposal.js";
import type { CandidateProfile } from "../domain/opportunity.js";
import type { RadarResult } from "../domain/radar.js";
import { sanitizeProposalInput } from "../domain/security.js";
import type { PersistencePort } from "../domain/persistence.js";

export interface ApprovalService {
  createForRadar(result: RadarResult, profile: CandidateProfile, now?: string): Promise<ApprovalRequest[]>;
  approve(id: string, now?: string): Promise<ApprovalRequest>;
  reject(id: string, now?: string): Promise<ApprovalRequest>;
}

export class DefaultApprovalService implements ApprovalService {
  constructor(private readonly persistence: PersistencePort) {}

  async createForRadar(result: RadarResult, profile: CandidateProfile, now = new Date().toISOString()): Promise<ApprovalRequest[]> {
    const created: ApprovalRequest[] = [];
    const pending = await this.persistence.listPendingApprovals();
    for (const ranked of result.ranked) {
      if (ranked.analysis.recommendation !== "apply") continue;
      const existing = pending.find((request) => request.opportunityId === ranked.opportunity.id);
      if (existing) { created.push(existing); continue; }
      const proposal = draftProposal(ranked.opportunity, profile);
      const request: ApprovalRequest = {
        id: `approval:${ranked.opportunity.id}`,
        opportunityId: ranked.opportunity.id,
        proposal: sanitizeProposalInput(`${proposal.subject}\n\n${proposal.body}`),
        state: "draft",
        createdAt: now,
      };
      const next = transitionApproval(request, "pending", now);
      await this.persistence.saveApproval(next);
      created.push(next);
    }
    return created;
  }

  async approve(id: string, now = new Date().toISOString()): Promise<ApprovalRequest> {
    const request = await this.findPending(id);
    const approved = transitionApproval(request, "approved", now);
    await this.persistence.saveApproval(approved);
    return approved;
  }

  async reject(id: string, now = new Date().toISOString()): Promise<ApprovalRequest> {
    const request = await this.findPending(id);
    const rejected = transitionApproval(request, "rejected", now);
    await this.persistence.saveApproval(rejected);
    return rejected;
  }

  private async findPending(id: string): Promise<ApprovalRequest> {
    const request = (await this.persistence.listPendingApprovals()).find((item) => item.id === id);
    if (!request) throw new Error(`Pending approval not found: ${id}`);
    return request;
  }
}
