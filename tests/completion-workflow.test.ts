import { describe, expect, it } from "vitest";
import { createDealForFinalApproval, decideDeal } from "../src/application/deal-service.js";
import { transitionApplication, type ApplicationRecord } from "../src/domain/application-tracking.js";
import { InMemoryEarningsStore } from "../src/domain/earnings.js";

describe("completion workflow", () => {
  it("requires valid terms and explicit deal approval", () => {
    const policy = { minimumFixedUsd: 10, maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true };
    const terms = { scope: "Build dashboard", priceUsd: 100, deliveryDays: 5, deliverables: ["Dashboard"], assumptions: [], risks: [] };
    const deal = createDealForFinalApproval("client:1", terms, policy, ["Scope and price reviewed"], "2026-09-09T00:00:00.000Z");
    expect(deal.state).toBe("pending_final_approval");
    expect(decideDeal(deal, "approved", "2026-09-09T00:01:00.000Z").state).toBe("approved");
  });

  it("preserves application lifecycle and rejects skipping approval", () => {
    const app: ApplicationRecord = { id: "app:1", opportunityId: "opp:1", source: "test", sourceUrl: "https://example.com/job/1", status: "draft", createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z" };
    expect(() => transitionApplication(app, "applied")).toThrow();
    const approved = transitionApplication(app, "approved");
    expect(transitionApplication(approved, "applied").status).toBe("applied");
  });

  it("records manual earnings without payment integration", () => {
    const store = new InMemoryEarningsStore();
    store.add({ id: "payment:1", projectTitle: "Dashboard", amount: 25, currency: "USD", receivedAt: "2026-09-09T00:00:00.000Z" });
    expect(store.summary()).toEqual({ totalReceived: 25, byCurrency: { USD: 25 }, payments: 1 });
  });
});
