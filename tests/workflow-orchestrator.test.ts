import { describe, expect, it } from "vitest";
import { PersonalWorkflowOrchestrator } from "../src/application/workflow-orchestrator.js";
import type { WorkMode } from "../src/domain/opportunity.js";

const profile = { displayName: "Test", headline: "Builder", bio: "Builder", skills: ["TypeScript"], evidence: [{ skill: "TypeScript", evidence: "work", strength: 1 }], preferredWorkModes: ["remote" as WorkMode], minimumHourlyUsd: 10, minimumFixedUsd: 10, location: "India", portfolio: [], services: [], platformAccounts: [], communicationStyle: "professional" as const, negotiation: { minimumFixedUsd: 10, maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true }, redFlags: [], lastUpdatedAt: "2026-09-09T00:00:00.000Z" };
const opportunity = { id: "opp:1", source: "test", sourceUrl: "https://example.com/job/1", title: "TypeScript dashboard", description: "Build a dashboard", skills: ["TypeScript"], workMode: "remote" as const, status: "new" as const, discoveredAt: "2026-09-09T00:00:00.000Z" };
const client = { id: "client:1", opportunityIds: ["opp:1"], source: "test", sourceUrl: opportunity.sourceUrl, stage: "interested" as const, fitScore: 80, legitimacyScore: 90, priorityScore: 85, summary: "Good fit", needs: [], objections: [], approachAngle: "", nextAction: "final approval", createdAt: opportunity.discoveredAt, updatedAt: opportunity.discoveredAt };

describe("personal workflow orchestrator", () => {
  it("keeps deal approval explicit", () => {
    const service = new PersonalWorkflowOrchestrator();
    const deal = service.prepareDeal(client, opportunity, profile, { scope: "Dashboard", priceUsd: 100, deliveryDays: 5, deliverables: ["Dashboard"], assumptions: [], risks: [] }, ["Confirmed scope"]);
    expect(deal.state).toBe("pending_final_approval");
    expect(service.approveDeal(deal.id).state).toBe("approved");
  });

  it("requires application approval before applied", () => {
    const service = new PersonalWorkflowOrchestrator();
    const application = service.createApplication(opportunity, client.id);
    expect(() => service.markApplied(application.id)).toThrow();
    const approved = service.approveApplication(application.id);
    expect(service.markApplied(approved.id).status).toBe("applied");
  });
});
