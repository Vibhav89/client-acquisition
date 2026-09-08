import { describe, expect, it } from "vitest";
import { DefaultApprovalService } from "../src/application/approval-service.js";
import { runRadar } from "../src/domain/radar.js";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import type { CandidateProfile, Opportunity } from "../src/domain/opportunity.js";

const profile: CandidateProfile = {
  skills: ["TypeScript", "React", "AI"],
  evidence: [{ skill: "TypeScript", evidence: "Built production TypeScript applications", strength: 1 }],
  preferredWorkModes: ["remote"],
};

const opportunity: Opportunity = {
  id: "job-approval", source: "test", sourceUrl: "https://example.com/job-approval",
  title: "TypeScript React AI Engineer", description: "Build a remote application.",
  skills: ["TypeScript", "React", "AI"], workMode: "remote", budget: { currency: "USD", min: 50, max: 100, unit: "hour" }, status: "new", discoveredAt: "2026-09-07T00:00:00Z",
};

describe("approval service", () => {
  it("creates a pending approval only for an apply recommendation", async () => {
    const persistence = new InMemoryPersistence(); persistence.saveOpportunity(opportunity);
    const service = new DefaultApprovalService(persistence); const radar = runRadar([opportunity], profile);
    const approvals = await service.createForRadar(radar, profile, "2026-09-07T01:00:00Z");
    expect(approvals).toHaveLength(1); expect(approvals[0]?.state).toBe("pending");
    expect(approvals[0]?.proposal).toContain("Built production TypeScript applications");
    expect(persistence.listPendingApprovals()).toHaveLength(1);
  });

  it("does not duplicate a pending approval", async () => {
    const persistence = new InMemoryPersistence(); persistence.saveOpportunity(opportunity);
    const service = new DefaultApprovalService(persistence); const radar = runRadar([opportunity], profile);
    const first = await service.createForRadar(radar, profile); const second = await service.createForRadar(radar, profile);
    expect(second[0]?.id).toBe(first[0]?.id); expect(persistence.listPendingApprovals()).toHaveLength(1);
  });

  it("approves and rejects through the domain transition guard", async () => {
    const persistence = new InMemoryPersistence(); persistence.saveOpportunity(opportunity);
    const service = new DefaultApprovalService(persistence); const radar = runRadar([opportunity], profile);
    const [approval] = await service.createForRadar(radar, profile);
    expect(approval).toBeDefined();
    const approved = await service.approve(approval!.id, "2026-09-07T02:00:00Z");
    expect(approved.state).toBe("approved"); expect(approved.decidedAt).toBe("2026-09-07T02:00:00Z");
    expect(persistence.listPendingApprovals()).toHaveLength(0);
    await expect(service.reject(approval!.id)).rejects.toThrow("Pending approval not found");
  });
});
