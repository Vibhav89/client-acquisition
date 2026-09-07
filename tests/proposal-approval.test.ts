import { describe, expect, it } from "vitest";
import { transitionApproval } from "../src/domain/approval.js";
import { draftProposal } from "../src/domain/proposal.js";
import type { CandidateProfile, Opportunity } from "../src/domain/opportunity.js";

const profile: CandidateProfile = {
  skills: ["TypeScript", "React"],
  evidence: [{ skill: "TypeScript", evidence: "Built production TypeScript applications", strength: 1 }],
  preferredWorkModes: ["remote"],
};

const opportunity: Opportunity = {
  id: "job-2",
  source: "test",
  sourceUrl: "https://example.com/job-2",
  title: "TypeScript React Engineer",
  description: "Build a dashboard.",
  skills: ["TypeScript", "React"],
  workMode: "remote",
  status: "new",
  discoveredAt: "2026-09-07T00:00:00Z",
};

describe("proposal and approval", () => {
  it("uses candidate evidence instead of inventing experience", () => {
    const draft = draftProposal(opportunity, profile);
    expect(draft.body).toContain("Built production TypeScript applications");
    expect(draft.claimsUsed).toHaveLength(1);
  });

  it("requires an explicit pending -> approved transition", () => {
    const request = { id: "a1", opportunityId: opportunity.id, proposal: "draft", state: "pending" as const, createdAt: "2026-09-07T00:00:00Z" };
    const approved = transitionApproval(request, "approved", "2026-09-07T01:00:00Z");
    expect(approved.state).toBe("approved");
    expect(approved.decidedAt).toBe("2026-09-07T01:00:00Z");
    expect(() => transitionApproval(approved, "pending")).toThrow("Invalid approval transition");
  });
});
