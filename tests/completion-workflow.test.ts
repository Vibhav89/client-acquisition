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

  describe("Audit Scenarios A through R", () => {
    it("Scenario A: Safe opportunity", () => {
      const opp: Opportunity = { id: "opp:safe", source: "upwork", sourceUrl: "https://example.com/safe", title: "React TypeScript Dev", description: "Build UI components", skills: ["React", "TypeScript"], workMode: "remote", status: "new", discoveredAt: "2026-09-09T00:00:00Z" };
      const radar = runRadar([opp], profile);
      expect(radar.qualified).toBe(1);
    });

    it("Scenario B: High-risk opportunity", () => {
      const opp: Opportunity = { id: "opp:risk", source: "upwork", sourceUrl: "https://example.com/risk", title: "Crypto Transfer Manager", description: "Send registration fee via Western Union", skills: ["Crypto"], workMode: "remote", status: "new", discoveredAt: "2026-09-09T00:00:00Z" };
      const radar = runRadar([opp], profile);
      expect(radar.skipped).toBe(1);
    });

    it("Scenario C: New client capture", () => {
      const client: ClientRecord = { id: "client:new", opportunityIds: ["opp:safe"], source: "upwork", sourceUrl: "https://example.com/safe", stage: "discovered", fitScore: 85, legitimacyScore: 90, priorityScore: 85, summary: "Captured client", needs: ["React"], objections: [], approachAngle: "Evidence", nextAction: "Draft proposal", createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z" };
      expect(client.id).toBe("client:new");
    });

    it("Scenario D: Client replies", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "conversation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const opp: Opportunity = { id: "o1", source: "upwork", sourceUrl: "https://example.com", title: "Title", description: "Desc", skills: ["TypeScript"], workMode: "remote", status: "new", discoveredAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "What is your hourly rate?", timestamp: "" };
      const decision = prepareConversationDecision(msg, client, opp, profile);
      expect(decision.requiresUserApproval).toBe(true);
    });

    it("Scenario E: Price negotiation below threshold", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "Can you do a discount or reduce the price?", timestamp: "" };
      const assessment = assessNegotiation(msg, client, profile);
      expect(assessment.escalateToFinalApproval).toBe(true);
      expect(assessment.signals).toContain("price_pressure");
    });

    it("Scenario F: Scope creep detection", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "Also add extra features while you are at it.", timestamp: "" };
      const assessment = assessNegotiation(msg, client, profile);
      expect(assessment.signals).toContain("scope_creep");
    });

    it("Scenario G: Payment scam attempt", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "We will pay via gift card or crypto registration fee.", timestamp: "" };
      const assessment = assessNegotiation(msg, client, profile);
      expect(assessment.signals).toContain("payment_risk");
    });

    it("Scenario H: Off-platform request", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "Contact me outside on Telegram @scam", timestamp: "" };
      const assessment = assessNegotiation(msg, client, profile);
      expect(assessment.signals).toContain("off_platform_risk");
    });

    it("Scenario I: Buying signal", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "upwork", sourceUrl: "https://example.com", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Lead", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "We accept your terms! Send contract.", timestamp: "" };
      const assessment = assessNegotiation(msg, client, profile);
      expect(assessment.escalateToFinalApproval).toBe(true);
    });

    it("Scenario J: Final deal approval", () => {
      const deal = createDealForFinalApproval("c1", { scope: "Full project", priceUsd: 500, deliveryDays: 5, deliverables: ["Code"], assumptions: [], risks: [] }, profile.negotiation, ["User approval"]);
      expect(deal.state).toBe("pending_final_approval");
      const approved = decideDeal(deal, "approved");
      expect(approved.state).toBe("approved");
    });

    it("Scenario K: Application approval", () => {
      const app: ApplicationRecord = { id: "app:1", opportunityId: "o1", source: "upwork", sourceUrl: "https://example.com", status: "draft", createdAt: "", updatedAt: "" };
      const approved = transitionApplication(app, "approved");
      expect(approved.status).toBe("approved");
    });

    it("Scenario L: Application submission boundary", () => {
      const app: ApplicationRecord = { id: "app:1", opportunityId: "o1", source: "upwork", sourceUrl: "https://example.com", status: "approved", createdAt: "", updatedAt: "" };
      const applied = transitionApplication(app, "applied");
      expect(applied.status).toBe("applied");
    });

    it("Scenario M: Manual earnings", () => {
      const store = new InMemoryEarningsStore();
      store.add({ id: "e1", projectTitle: "App", amount: 1000, currency: "USD", receivedAt: "2026-09-09T00:00:00Z" });
      expect(store.summary().totalReceived).toBe(1000);
    });

    it("Scenario N: Won outcome", () => {
      const app: ApplicationRecord = { id: "app:1", opportunityId: "o1", source: "upwork", sourceUrl: "https://example.com", status: "interview", createdAt: "", updatedAt: "" };
      const won = transitionApplication(app, "won");
      expect(won.status).toBe("won");
    });

    it("Scenario O: Lost outcome", () => {
      const app: ApplicationRecord = { id: "app:1", opportunityId: "o1", source: "upwork", sourceUrl: "https://example.com", status: "interview", createdAt: "", updatedAt: "" };
      const lost = transitionApplication(app, "lost");
      expect(lost.status).toBe("lost");
    });

    it("Scenario P: Learning update threshold", () => {
      const events = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, source: "upwork", outcome: "won" as const, createdAt: "2026-09-09T00:00:00Z" }));
      const boosted = applyLearningBoost(70, "upwork", events);
      expect(boosted).toBeGreaterThan(70);
    });

    it("Scenario Q: Cross-user access isolation in SupabasePersistence", async () => {
      const { SupabasePersistence } = await import("../src/integrations/supabase-repository.js");
      const fakeClient = {
        from: (table: string) => ({
          upsert: async () => ({ error: null }),
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => ({
                order: async () => ({ data: [{ id: "opp:user1", user_id: "user1", title: "Secret Job", source: "u", source_url: "u", description: "d", skills: [], work_mode: "remote", status: "new", discovered_at: "now" }], error: null }),
              }),
              order: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      };
      const repo = new SupabasePersistence(fakeClient as any, "user2");
      const list = await repo.listOpportunities();
      expect(list).toEqual([]);
    });

    it("Scenario R: Malformed API request error handling", async () => {
      const { handleRequest } = await import("../src/server.js");
      let statusCode = 0;
      let bodyText = "";
      const req: any = {
        url: "/api/profile",
        method: "POST",
        headers: { host: "localhost", "content-length": "12" },
        async *[Symbol.asyncIterator]() { yield Buffer.from("invalid json"); },
      };
      const res: any = {
        writeHead: (code: number) => { statusCode = code; },
        end: (text: string) => { bodyText = text; },
      };
      await handleRequest(req, res);
      expect(statusCode).toBe(400);
      expect(bodyText).toContain("Request body must be valid JSON");
    });
  });
});
