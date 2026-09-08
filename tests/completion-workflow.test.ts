import { describe, expect, it } from "vitest";
import { createDealForFinalApproval, decideDeal } from "../src/application/deal-service.js";
import { transitionApplication, type ApplicationRecord } from "../src/domain/application-tracking.js";
import { transitionDealApproval } from "../src/domain/deal.js";
import { InMemoryEarningsStore } from "../src/domain/earnings.js";
import { runRadar } from "../src/domain/radar.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import { assessNegotiation } from "../src/domain/negotiation-guardrails.js";
import { prepareConversationDecision } from "../src/domain/conversation.js";
import { InMemoryLearningStore, eventFromClientOutcome, applyLearningBoost } from "../src/domain/learning.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import type { ClientRecord, ConversationMessage } from "../src/domain/client.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

const profile: PersonalAgentProfile = {
  displayName: "Vibhav", headline: "Senior Engineer", bio: "Production engineer",
  skills: ["TypeScript", "React", "AI"],
  evidence: [{ skill: "TypeScript", evidence: "Built apps", strength: 1 }, { skill: "React", evidence: "Built UIs", strength: 1 }],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 15, minimumFixedUsd: 50,
  portfolio: [], services: [], platformAccounts: [], communicationStyle: "professional",
  negotiation: { minimumHourlyUsd: 15, minimumFixedUsd: 50, preferredHourlyUsd: 30, preferredFixedUsd: 200, maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true },
  redFlags: [], lastUpdatedAt: "2026-09-09T00:00:00.000Z",
};

describe("completion workflow end-to-end", () => {
  it("executes complete lifecycle from opportunity to deal, application, work, manual payment, and learning outcome", () => {
    // 1. Opportunity Discovery & Qualification
    const opp: Opportunity = {
      id: "opp:e2e", source: "upwork", sourceUrl: "https://www.upwork.com/jobs/~e2e",
      title: "TypeScript React Engineer", description: "Build scalable web app",
      skills: ["TypeScript", "React"], workMode: "remote",
      budget: { currency: "USD", min: 30, max: 60, unit: "hour" },
      status: "new", discoveredAt: "2026-09-09T00:00:00.000Z",
    };
    const radar = runRadar([opp], profile);
    expect(radar.qualified).toBe(1);

    // 2. Client Intake & Grounded Inbound Reply
    const client: ClientRecord = {
      id: "client:e2e", opportunityIds: [opp.id], source: opp.source, sourceUrl: opp.sourceUrl,
      stage: "conversation", fitScore: 90, legitimacyScore: 95, priorityScore: 90,
      summary: "Qualified lead", needs: ["TypeScript", "React"], objections: [], approachAngle: "Lead with evidence",
      suggestedPriceUsd: 50, suggestedDeliveryDays: 7, nextAction: "Review reply",
      createdAt: opp.discoveredAt, updatedAt: opp.discoveredAt,
    };
    const msg: ConversationMessage = {
      id: "m:e2e:1", clientId: client.id, direction: "inbound",
      body: "We like your profile. How much for the TypeScript component work?", timestamp: "2026-09-09T01:00:00.000Z",
    };
    const decision = prepareConversationDecision(msg, client, opp, profile);
    expect(decision.requiresUserApproval).toBe(true);
    expect(decision.suggestedReply).toContain("50");

    // 3. Negotiation Guardrails & Final Approval Deal
    const negMsg: ConversationMessage = { ...msg, body: "Sounds good, when can we start?" };
    const negAssessment = assessNegotiation(negMsg, client, profile);
    expect(negAssessment.escalateToFinalApproval).toBe(true);

    const dealTerms = { scope: "Build component library", priceUsd: 350, deliveryDays: 5, deliverables: ["UI components"], assumptions: [], risks: [] };
    const deal = createDealForFinalApproval(client.id, dealTerms, profile.negotiation, ["Confirmed scope"]);
    expect(deal.state).toBe("pending_final_approval");

    const approvedDeal = decideDeal(deal, "approved");
    expect(approvedDeal.state).toBe("approved");

    // 4. Application State Machine
    const app: ApplicationRecord = {
      id: "app:e2e", opportunityId: opp.id, clientId: client.id,
      source: opp.source, sourceUrl: opp.sourceUrl, status: "draft",
      createdAt: "2026-09-09T02:00:00.000Z", updatedAt: "2026-09-09T02:00:00.000Z",
    };
    const appApproved = transitionApplication(app, "approved");
    const appApplied = transitionApplication(appApproved, "applied");
    const appInterview = transitionApplication(appApplied, "interview");
    const appWon = transitionApplication(appInterview, "won");
    expect(appWon.status).toBe("won");

    // 5. Work & Manual Payment Recording
    const earningsStore = new InMemoryEarningsStore();
    earningsStore.add({ id: "pay:e2e:1", clientId: client.id, applicationId: app.id, projectTitle: opp.title, amount: 350, currency: "USD", receivedAt: "2026-09-09T03:00:00.000Z" });
    earningsStore.add({ id: "pay:e2e:2", clientId: client.id, applicationId: app.id, projectTitle: opp.title, amount: 50, currency: "EUR", receivedAt: "2026-09-09T04:00:00.000Z" });
    const summary = earningsStore.summary();
    expect(summary.byCurrency).toEqual({ USD: 350, EUR: 50 });
    expect(summary.payments).toBe(2);

    // 6. Learning Loop Integration
    const learningStore = new InMemoryLearningStore();
    const event = eventFromClientOutcome(client, "won", "Client hired for TypeScript component library", opp.id);
    learningStore.save(event);
    expect(learningStore.list()).toHaveLength(1);
  });

  it("enforces negative path guardrails: scam detection, invalid state transitions, zero/negative earnings", () => {
    // Negative Path 1: Scam opportunity is skipped
    const scamOpp: Opportunity = {
      id: "opp:scam", source: "upwork", sourceUrl: "https://example.com/scam",
      title: "Easy Job", description: "Pay fee and registration fee before receiving payment in crypto.",
      skills: ["React"], workMode: "remote", status: "new", discoveredAt: "2026-09-09T00:00:00.000Z",
    };
    const radar = runRadar([scamOpp], profile);
    expect(radar.skipped).toBe(1);

    // Negative Path 2: Invalid direct application transition (draft -> applied)
    const draftApp: ApplicationRecord = {
      id: "app:draft", opportunityId: "opp:1", source: "test", sourceUrl: "https://example.com/1",
      status: "draft", createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z",
    };
    expect(() => transitionApplication(draftApp, "applied")).toThrow("Invalid application transition: draft -> applied");

    // Negative Path 3: Invalid deal state transition (draft -> won)
    const deal = createDealForFinalApproval("c1", { scope: "Scope", priceUsd: 100, deliveryDays: 3, deliverables: ["Doc"], assumptions: [], risks: [] }, profile.negotiation, ["Rationale"]);
    expect(() => transitionDealApproval(deal, "won")).toThrow("Invalid deal transition: pending_final_approval -> won");

    // Negative Path 4: Invalid earnings amount (zero or negative)
    const earningsStore = new InMemoryEarningsStore();
    expect(() => earningsStore.add({ id: "pay:bad", projectTitle: "Invalid", amount: 0, currency: "USD", receivedAt: "2026-09-09T00:00:00.000Z" })).toThrow("Earnings amount must be greater than zero");

    // Negative Path 5: Small sample does not distort learning engine boost
    const fewEvents = [
      { id: "1", source: "upwork", outcome: "won" as const, createdAt: "2026-09-09T00:00:00.000Z" },
      { id: "2", source: "upwork", outcome: "won" as const, createdAt: "2026-09-09T00:00:00.000Z" },
    ];
    expect(applyLearningBoost(70, "upwork", fewEvents)).toBe(70);
  });
});
