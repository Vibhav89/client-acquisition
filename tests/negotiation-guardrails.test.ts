import { describe, expect, it } from "vitest";
import { assessNegotiation } from "../src/domain/negotiation-guardrails.js";
import type { ConversationMessage, ClientRecord } from "../src/domain/client.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

const client = { id: "c1", name: "Client", source: "test", sourceUrl: "https://example.com/job", stage: "conversation", summary: "Test client", priorityScore: 80, fitScore: 80, legitimacyScore: 90, updatedAt: "2026-09-08T10:00:00.000Z", nextAction: "Reply" } as ClientRecord;
const profile = { negotiation: { maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true } } as PersonalAgentProfile;
const message = (body: string) => ({ id: "m1", direction: "inbound", body, timestamp: "2026-09-08T11:00:00.000Z" } as ConversationMessage);

describe("negotiation guardrails", () => {
  it("protects against risky payment requests", () => {
    const result = assessNegotiation(message("Can you pay a registration fee in crypto?"), client, profile);
    expect(result.signals).toEqual(expect.arrayContaining(["payment_risk"]));
    expect(result.strategy).toBe("hold_for_approval");
    expect(result.escalateToFinalApproval).toBe(true);
  });

  it("detects scope creep and requires confirmation", () => {
    const result = assessNegotiation(message("Also add another feature while you're at it"), client, profile);
    expect(result.signals).toContain("scope_creep");
    expect(result.escalateToFinalApproval).toBe(true);
  });

  it("handles price pressure without silently accepting a discount", () => {
    const result = assessNegotiation(message("Can you reduce the price?"), client, profile);
    expect(result.signals).toContain("price_pressure");
    expect(result.strategy).toBe("protect_margin");
    expect(result.requiresUserApproval).toBe(true);
  });

  it("escalates buying signals before commitment", () => {
    const result = assessNegotiation(message("Sounds good, when can we start?"), client, profile);
    expect(result.signals).toEqual(expect.arrayContaining(["buying_signal", "commitment"]));
    expect(result.escalateToFinalApproval).toBe(true);
  });
});
