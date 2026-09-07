import { describe, expect, it } from "vitest";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import type { Opportunity } from "../src/domain/opportunity.js";

describe("InMemoryPersistence", () => {
  const opportunity: Opportunity = {
    id: "job-1",
    source: "test",
    sourceUrl: "https://example.com/job-1",
    title: "TypeScript Engineer",
    description: "Remote TypeScript work",
    skills: ["TypeScript"],
    workMode: "remote",
    status: "new",
    discoveredAt: "2026-09-07T00:00:00Z",
  };

  it("upserts opportunities by id", () => {
    const store = new InMemoryPersistence();
    store.saveOpportunity(opportunity);
    store.saveOpportunity({ ...opportunity, title: "Updated title" });
    expect(store.listOpportunities()).toHaveLength(1);
    expect(store.getOpportunity("job-1")?.title).toBe("Updated title");
  });

  it("prevents orphan approvals", () => {
    const store = new InMemoryPersistence();
    expect(() => store.saveApproval({
      id: "approval-1",
      opportunityId: "missing",
      proposal: "draft",
      state: "pending",
      createdAt: "2026-09-07T00:00:00Z",
    })).toThrow("unknown opportunity");
  });

  it("returns only pending approvals", () => {
    const store = new InMemoryPersistence();
    store.saveOpportunity(opportunity);
    store.saveApproval({ id: "pending", opportunityId: "job-1", proposal: "draft", state: "pending", createdAt: "2026-09-07T00:00:00Z" });
    store.saveApproval({ id: "approved", opportunityId: "job-1", proposal: "draft", state: "approved", createdAt: "2026-09-07T00:00:00Z", decidedAt: "2026-09-07T01:00:00Z" });
    expect(store.listPendingApprovals().map((item) => item.id)).toEqual(["pending"]);
  });
});
