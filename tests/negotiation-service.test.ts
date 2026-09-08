import { describe, expect, it } from "vitest";
import { prepareNegotiationDecision } from "../src/application/negotiation-service.js";
import { InMemoryEventHistory } from "../src/domain/event-history.js";
import type { ClientRecord } from "../src/domain/client.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";
import type { Opportunity } from "../src/domain/opportunity.js";

const client = { id: "client:1", source: "demo", sourceUrl: "https://example.com/job", stage: "conversation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Demo", needs: [], objections: [], approachAngle: "delivery", suggestedPriceUsd: 100, nextAction: "Reply", opportunityIds: ["opp:1"], createdAt: "2026-09-08T10:00:00.000Z", updatedAt: "2026-09-08T10:00:00.000Z" } as ClientRecord;
const opportunity = { id: "opp:1", source: "demo", sourceUrl: client.sourceUrl, title: "React dashboard", description: "Build dashboard", skills: ["React"], workMode: "remote", status: "qualified", discoveredAt: client.createdAt } as Opportunity;
const profile = { negotiation: { maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true } } as PersonalAgentProfile;

describe("negotiation service", () => {
  it("records a reply-prepared and deal-review history event when approval is required", async () => {
    const history = new InMemoryEventHistory();
    const result = await prepareNegotiationDecision(client, opportunity, profile, "We want to hire you. Let's move forward.", "demo", "2026-09-08T12:00:00.000Z", history);
    const events = await history.list({ entityId: client.id });
    expect(result.requiresUserApproval).toBe(true);
    expect(result.escalateToFinalApproval).toBe(true);
    expect(events.map((event) => event.type)).toEqual(["reply_prepared", "deal_reviewed"]);
  });
});
