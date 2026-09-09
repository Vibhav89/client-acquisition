import { describe, expect, it } from "vitest";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import { transitionApproval } from "../src/domain/approval.js";
import type { ApprovalRequest } from "../src/domain/approval.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import { runRadar } from "../src/domain/radar.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import { sanitizeProposalInput, isSafeExternalUrl } from "../src/domain/security.js";

const baseOpportunity = (id: string, url = `https://example.com/${id}`): Opportunity => ({
  id, source: "test", sourceUrl: url, title: "React TypeScript AI developer",
  description: "Build a React TypeScript AI dashboard.", skills: ["React", "TypeScript", "AI"],
  workMode: "remote", budget: { currency: "USD", min: 20, max: 40, unit: "hour" },
  status: "new", discoveredAt: "2026-09-08T00:00:00Z",
});

describe("hardening", () => {
  it("rejects unsafe external URLs and sanitizes control characters", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("https://example.com/job")).toBe(true);
    expect(sanitizeProposalInput("hello\u0000\u0007 world")).toBe("hello world");
  });

  it("prevents approval state from being changed after a terminal decision", () => {
    const pending: ApprovalRequest = { id: "a1", opportunityId: "o1", proposal: "Apply", state: "pending", createdAt: "2026-09-08T00:00:00Z" };
    const approved = transitionApproval(pending, "approved");
    expect(() => transitionApproval(approved, "rejected")).toThrow("Invalid approval transition");
    expect(() => transitionApproval(approved, "approved")).toThrow("Invalid approval transition");
  });

  it("rejects orphan approvals in persistence", async () => {
    const store = new InMemoryPersistence();
    const approval: ApprovalRequest = { id: "a1", opportunityId: "missing", proposal: "Apply", state: "pending", createdAt: "2026-09-08T00:00:00Z" };
    await expect(store.saveApproval(approval)).rejects.toThrow("Unknown opportunity");
  });

  it("deduplicates repeated source records deterministically", () => {
    const first = baseOpportunity("same");
    const second = { ...first, description: "updated duplicate" };
    const result = runRadar([first, second], defaultCandidateProfile);
    expect(result.discovered).toBe(2);
    expect(result.analyzed).toBe(1);
    expect(result.ranked[0]?.opportunity.description).toBe("updated duplicate");
  });

  it("deduplicates tracking variants of the same canonical source URL", () => {
    const first = baseOpportunity("one", "https://example.com/job/42?utm_source=feed");
    const second = baseOpportunity("two", "https://example.com/job/42?utm_medium=email");
    const result = runRadar([first, second], defaultCandidateProfile);
    expect(result.discovered).toBe(2);
    expect(result.analyzed).toBe(1);
  });
});
