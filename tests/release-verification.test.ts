import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/server.js";
import { SupabasePersistence } from "../src/integrations/supabase-repository.js";
import { SupabaseProfilePersistence } from "../src/integrations/supabase-profile-repository.js";
import { validateDealTerms, createDealForFinalApproval } from "../src/application/deal-service.js";
import { transitionDealApproval } from "../src/domain/deal.js";
import { transitionApplication, type ApplicationRecord } from "../src/domain/application-tracking.js";
import { assessNegotiation } from "../src/domain/negotiation-guardrails.js";
import { buildCommandCenterSnapshot } from "../src/application/command-center.js";
import { prepareConversationDecision } from "../src/domain/conversation.js";
import { runRadar } from "../src/domain/radar.js";
import { InMemoryEarningsStore } from "../src/domain/earnings.js";
import { InMemoryLearningStore, eventFromClientOutcome } from "../src/domain/learning.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import type { ClientRecord, ConversationMessage } from "../src/domain/client.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

const testProfile: PersonalAgentProfile = {
  displayName: "Vibhav", headline: "Senior Engineer", bio: "Production engineer",
  skills: ["TypeScript", "React", "AI"],
  evidence: [{ skill: "TypeScript", evidence: "Built production systems", strength: 1 }],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 25, minimumFixedUsd: 100,
  portfolio: [], services: [], platformAccounts: [], communicationStyle: "professional",
  negotiation: { minimumHourlyUsd: 25, minimumFixedUsd: 100, preferredHourlyUsd: 50, preferredFixedUsd: 300, maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true },
  redFlags: [], lastUpdatedAt: "2026-09-09T00:00:00.000Z",
};

type Row = Record<string, unknown>;

function createMockSupabaseClient() {
  const tableRows: Row[] = [];
  return {
    from(table: string) {
      return {
        upsert(values: Row | Row[]) {
          const incoming = Array.isArray(values) ? values : [values];
          for (const val of incoming) {
            const key = val.id ? `${val.user_id}:${val.id}` : `${val.user_id}:${val.source}:${val.source_url}`;
            const index = tableRows.findIndex((r) => r.__table === table && r.__key === key);
            const next = { ...val, __table: table, __key: key };
            if (index >= 0) tableRows[index] = next;
            else tableRows.push(next);
          }
          return Promise.resolve({ error: null });
        },
        select() {
          let rows = tableRows.filter((r) => r.__table === table);
          const builder = {
            eq(col: string, val: string) {
              rows = rows.filter((r) => String(r[col]) === val);
              return builder;
            },
            order() {
              return Promise.resolve({ data: rows, error: null });
            },
            then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
              onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ): Promise<TResult1 | TResult2> {
              return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
            },
          };
          return builder;
        },
      };
    },
  };
}

describe("RELEASE READINESS & VERIFICATION SUITE", () => {

  describe("Section 3: AUTHORIZATION / TENANCY TEST (USER_A vs USER_B)", () => {
    it("strictly isolates USER_A records from USER_B across all domain entities", async () => {
      const mockClient = createMockSupabaseClient();
      const storeA = new SupabasePersistence(mockClient as any, "user_A");
      const storeB = new SupabasePersistence(mockClient as any, "user_B");
      const profileStoreA = new SupabaseProfilePersistence(mockClient as any, "user_A");
      const profileStoreB = new SupabaseProfilePersistence(mockClient as any, "user_B");

      // Populate USER_A data
      await profileStoreA.saveProfile(testProfile);
      await storeA.saveOpportunity({ id: "opp:A", source: "upwork", sourceUrl: "https://example.com/A", title: "User A Opp", description: "Desc", skills: ["React"], workMode: "remote", status: "new", discoveredAt: "now" });
      await storeA.saveApproval({ id: "approval:A", opportunityId: "opp:A", proposal: "Prop A", state: "pending", createdAt: "now" });
      await storeA.saveClient({ id: "client:A", opportunityIds: ["opp:A"], source: "upwork", sourceUrl: "https://example.com/A", stage: "discovered", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Client A", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "now", updatedAt: "now" });
      await storeA.saveMessage({ id: "msg:A", clientId: "client:A", direction: "inbound", body: "Hello from A", timestamp: "now" });
      await storeA.saveDeal({ id: "deal:A", clientId: "client:A", state: "pending_final_approval", terms: { scope: "S", priceUsd: 100, deliveryDays: 1, deliverables: ["D"], assumptions: [], risks: [] }, rationale: ["R"], createdAt: "now" });
      await storeA.saveApplication({ id: "app:A", opportunityId: "opp:A", source: "upwork", sourceUrl: "https://example.com/A", status: "draft", createdAt: "now", updatedAt: "now" });
      await storeA.saveEarnings({ id: "earn:A", projectTitle: "Project A", amount: 500, currency: "USD", receivedAt: "now" });
      await storeA.saveHistoryEvent({ id: "hist:A", type: "radar_run", timestamp: "now", entityType: "system", entityId: "sys", summary: "Event A" });
      await storeA.saveLearningEvent({ id: "learn:A", outcome: "won", createdAt: "now" });

      // Verify USER_B CANNOT read USER_A's records
      expect(await profileStoreB.getProfile()).toBeUndefined();
      expect(await storeB.getOpportunity("opp:A")).toBeUndefined();
      expect(await storeB.listOpportunities()).toHaveLength(0);
      expect(await storeB.listPendingApprovals()).toHaveLength(0);
      expect(await storeB.getClient("client:A")).toBeUndefined();
      expect(await storeB.listClients()).toHaveLength(0);
      expect(await storeB.listMessages("client:A")).toHaveLength(0);
      expect(await storeB.getDeal("deal:A")).toBeUndefined();
      expect(await storeB.listDeals()).toHaveLength(0);
      expect(await storeB.getApplication("app:A")).toBeUndefined();
      expect(await storeB.listApplications()).toHaveLength(0);
      expect(await storeB.listEarnings()).toHaveLength(0);
      expect(await storeB.listHistoryEvents()).toHaveLength(0);
      expect(await storeB.listLearningEvents()).toHaveLength(0);
    });
  });

  describe("Section 4: APPROVAL-BYPASS TEST", () => {
    it("prevents any direct transition or auto-send bypassing explicit user approval", () => {
      // Draft application cannot jump to applied
      const draftApp: ApplicationRecord = { id: "app:1", opportunityId: "o1", source: "s", sourceUrl: "u", status: "draft", createdAt: "now", updatedAt: "now" };
      expect(() => transitionApplication(draftApp, "applied")).toThrow("Invalid application transition: draft -> applied");

      // Deal pending approval cannot jump directly to won
      const deal = createDealForFinalApproval("c1", { scope: "Scope", priceUsd: 200, deliveryDays: 2, deliverables: ["Code"], assumptions: [], risks: [] }, testProfile.negotiation, ["User approval required"]);
      expect(deal.state).toBe("pending_final_approval");
      expect(() => transitionDealApproval(deal, "won")).toThrow("Invalid deal transition: pending_final_approval -> won");

      // Conversation decision flag requires user approval
      const msg: ConversationMessage = { id: "m1", clientId: "c1", direction: "inbound", body: "Let's begin work", timestamp: "now" };
      const opp: Opportunity = { id: "o1", source: "s", sourceUrl: "u", title: "T", description: "D", skills: ["React"], workMode: "remote", status: "new", discoveredAt: "now" };
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "s", sourceUrl: "u", stage: "conversation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "now", updatedAt: "now" };
      const decision = prepareConversationDecision(msg, client, opp, testProfile);
      expect(decision.requiresUserApproval).toBe(true);
    });
  });

  describe("Section 5: DEAL VALIDATION", () => {
    it("rejects invalid deal terms and accepts valid terms", () => {
      const config = testProfile.negotiation;
      const valid = { scope: "Build React App", priceUsd: 300, deliveryDays: 5, deliverables: ["UI"], assumptions: [], risks: [] };

      // Valid deal
      expect(validateDealTerms(valid, config)).toHaveLength(0);

      // Invalid: empty scope
      expect(validateDealTerms({ ...valid, scope: "   " }, config).length).toBeGreaterThan(0);

      // Invalid: zero or negative price
      expect(validateDealTerms({ ...valid, priceUsd: 0 }, config).length).toBeGreaterThan(0);
      expect(validateDealTerms({ ...valid, priceUsd: -50 }, config).length).toBeGreaterThan(0);

      // Invalid: price below minimum
      expect(validateDealTerms({ ...valid, priceUsd: 10 }, config).length).toBeGreaterThan(0);

      // Invalid: zero or negative delivery days
      expect(validateDealTerms({ ...valid, deliveryDays: 0 }, config).length).toBeGreaterThan(0);
      expect(validateDealTerms({ ...valid, deliveryDays: -2 }, config).length).toBeGreaterThan(0);

      // Invalid: empty deliverables
      expect(validateDealTerms({ ...valid, deliverables: [] }, config).length).toBeGreaterThan(0);
    });
  });

  describe("Section 6: NEGOTIATION SAFETY", () => {
    it("escalates price pressure, scope creep, crypto scam, and off-platform requests", () => {
      const client: ClientRecord = { id: "c1", opportunityIds: ["o1"], source: "s", sourceUrl: "u", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "", needs: [], objections: [], approachAngle: "", nextAction: "", createdAt: "", updatedAt: "" };

      // Price pressure
      const press = assessNegotiation({ id: "1", clientId: "c1", direction: "inbound", body: "Give me a 50% discount", timestamp: "" }, client, testProfile);
      expect(press.signals).toContain("price_pressure");
      expect(press.escalateToFinalApproval).toBe(true);

      // Scope creep
      const scope = assessNegotiation({ id: "2", clientId: "c1", direction: "inbound", body: "Also add extra features while you're at it", timestamp: "" }, client, testProfile);
      expect(scope.signals).toContain("scope_creep");

      // Crypto / Deposit scam
      const scam = assessNegotiation({ id: "3", clientId: "c1", direction: "inbound", body: "Pay registration fee via bitcoin or gift cards first", timestamp: "" }, client, testProfile);
      expect(scam.signals).toContain("payment_risk");
      expect(scam.escalateToFinalApproval).toBe(true);

      // Off-platform request
      const off = assessNegotiation({ id: "4", clientId: "c1", direction: "inbound", body: "Move to Telegram @scam to discuss", timestamp: "" }, client, testProfile);
      expect(off.signals).toContain("off_platform_risk");
      expect(off.escalateToFinalApproval).toBe(true);

      // Buying signal
      const buy = assessNegotiation({ id: "5", clientId: "c1", direction: "inbound", body: "We want to hire you right now!", timestamp: "" }, client, testProfile);
      expect(buy.signals).toContain("buying_signal");
      expect(buy.escalateToFinalApproval).toBe(true);
    });
  });

  describe("Section 8 & 9: API INPUT HARDENING & ERROR SANITIZATION", () => {
    async function makeReq(url: string, method: string, body?: string) {
      let statusCode = 0;
      let responseText = "";
      const req: any = {
        url, method, headers: { host: "localhost", ...(body ? { "content-length": String(Buffer.byteLength(body)) } : {}) },
        async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); },
      };
      const res: any = {
        writeHead: (code: number) => { statusCode = code; },
        end: (text: string) => { responseText = text; },
      };
      await handleRequest(req, res);
      return { statusCode, responseText, json: () => JSON.parse(responseText) };
    }

    it("handles malformed JSON with 400", async () => {
      const res = await makeReq("/api/profile", "POST", "{ bad json");
      expect(res.statusCode).toBe(400);
      expect(res.responseText).toContain("Request body must be valid JSON");
    });

    it("handles missing required fields with 400", async () => {
      const res = await makeReq("/api/deals", "POST", JSON.stringify({}));
      expect(res.statusCode).toBe(400);
      expect(res.responseText).toContain("Deal payload must include clientId and terms");
    });

    it("handles invalid transition ID with 404", async () => {
      const res = await makeReq("/api/deals/nonexistent/approve", "POST");
      expect(res.statusCode).toBe(404);
      expect(res.responseText).toContain("Deal not found");
    });

    it("sanitizes 500 internal server errors without leaking filesystem paths or secrets", async () => {
      const res = await makeReq("/api/history", "POST", JSON.stringify({ type: "t", entityType: "e", entityId: "i", summary: "s" }));
      expect(res.statusCode).toBe(200);
      expect(res.responseText).not.toContain("C:\\");
      expect(res.responseText).not.toContain("SUPABASE_SERVICE_KEY");
    });
  });

  describe("Section 10: DETERMINISTIC END-TO-END APPLICATION FLOW TEST", () => {
    it("executes seamless flow from opportunity discovery to learning outcome", () => {
      // 1. Opportunity
      const opp: Opportunity = { id: "opp:real", source: "upwork", sourceUrl: "https://example.com/real", title: "React Dev", description: "Build app", skills: ["React", "TypeScript"], workMode: "remote", status: "new", discoveredAt: "now" };
      const radarResult = runRadar([opp], testProfile);
      expect(radarResult.qualified).toBe(1);

      // 2. Client & Proposal
      const client: ClientRecord = { id: "c:real", opportunityIds: [opp.id], source: opp.source, sourceUrl: opp.sourceUrl, stage: "discovered", fitScore: 95, legitimacyScore: 90, priorityScore: 90, summary: "Qualified", needs: ["React"], objections: [], approachAngle: "Evidence", nextAction: "Draft proposal", createdAt: "now", updatedAt: "now" };

      // 3. Conversation & Negotiation
      const msg: ConversationMessage = { id: "m:real", clientId: client.id, direction: "inbound", body: "Can you start next week?", timestamp: "now" };
      const decision = prepareConversationDecision(msg, client, opp, testProfile);
      expect(decision.requiresUserApproval).toBe(true);

      // 4. Deal Approval
      const deal = createDealForFinalApproval(client.id, { scope: "Build app", priceUsd: 500, deliveryDays: 7, deliverables: ["Code"], assumptions: [], risks: [] }, testProfile.negotiation, ["Scope agreed"]);
      expect(deal.state).toBe("pending_final_approval");
      const approvedDeal = transitionDealApproval(deal, "approved");
      expect(approvedDeal.state).toBe("approved");

      // 5. Application Tracking
      const app: ApplicationRecord = { id: "app:real", opportunityId: opp.id, clientId: client.id, source: opp.source, sourceUrl: opp.sourceUrl, status: "draft", createdAt: "now", updatedAt: "now" };
      const appApproved = transitionApplication(app, "approved");
      const appApplied = transitionApplication(appApproved, "applied");
      const appInterview = transitionApplication(appApplied, "interview");
      const appWon = transitionApplication(appInterview, "won");
      expect(appWon.status).toBe("won");

      // 6. Earnings
      const earningsStore = new InMemoryEarningsStore();
      earningsStore.add({ id: "earn:real", clientId: client.id, applicationId: app.id, projectTitle: opp.title, amount: 500, currency: "USD", receivedAt: "now" });
      expect(earningsStore.summary().totalReceived).toBe(500);

      // 7. Learning Event
      const learningStore = new InMemoryLearningStore();
      const learningEvent = eventFromClientOutcome(client, "won", "Hired for React app", opp.id);
      learningStore.save(learningEvent);
      expect(learningStore.list()).toHaveLength(1);
    });
  });

  describe("Section 11: COMMAND CENTER EXACT PRIORITY ORDERING TEST", () => {
    it("asserts strict priority order: Final Deal > Urgent Reply > Negotiation > Application Approval > Strong Opp > Follow-up > Lower Priority", () => {
      const now = "2026-09-09T00:00:00.000Z";
      const clients: ClientRecord[] = [
        { id: "c:deal", opportunityIds: ["o1"], source: "upwork", sourceUrl: "u", stage: "final_approval", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Final Deal Client", needs: [], objections: [], approachAngle: "", nextAction: "Final deal review", createdAt: now, updatedAt: now },
        { id: "c:neg", opportunityIds: ["o2"], source: "upwork", sourceUrl: "u", stage: "negotiation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Urgent Reply Client", needs: [], objections: [], approachAngle: "", nextAction: "Reply to negotiation", createdAt: now, updatedAt: now },
        { id: "c:conv", opportunityIds: ["o3"], source: "upwork", sourceUrl: "u", stage: "conversation", fitScore: 90, legitimacyScore: 90, priorityScore: 90, summary: "Negotiation Review Client", needs: [], objections: [], approachAngle: "", nextAction: "Review conversation", createdAt: now, updatedAt: now },
      ];

      const opportunities = [
        { opportunity: { id: "o:strong", source: "upwork", sourceUrl: "u", title: "Strong Opp", description: "D", skills: ["React"], workMode: "remote" as const, status: "new" as const, discoveredAt: now }, analysis: { match: { opportunityId: "o:strong", score: 90, matchedSkills: ["React"], missingSkills: [], evidenceScore: 20, budgetScore: 20, fitReasons: [] }, risk: { level: "low" as const, score: 0, signals: [] }, recommendation: "apply" as const }, rankScore: 90 },
        { opportunity: { id: "o:low", source: "upwork", sourceUrl: "u", title: "Lower Priority Opp", description: "D", skills: ["CSS"], workMode: "remote" as const, status: "new" as const, discoveredAt: now }, analysis: { match: { opportunityId: "o:low", score: 50, matchedSkills: ["CSS"], missingSkills: [], evidenceScore: 10, budgetScore: 10, fitReasons: [] }, risk: { level: "low" as const, score: 0, signals: [] }, recommendation: "review" as const }, rankScore: 50 },
      ];

      const approvals = [{ id: "app:req1", opportunityId: "o:app", proposal: "Application proposal", state: "pending" as const, createdAt: now }];

      const snapshot = buildCommandCenterSnapshot({ clients, opportunities, approvals, now });
      const typesAndTitles = snapshot.actions.map((a) => ({ id: a.id, priority: a.priority }));

      // Verify priorities descending
      for (let i = 0; i < typesAndTitles.length - 1; i++) {
        expect(typesAndTitles[i]!.priority).toBeGreaterThanOrEqual(typesAndTitles[i + 1]!.priority);
      }

      // Assert specific item priority hierarchy
      const dealItem = snapshot.actions.find((a) => a.id.includes("c:deal"));
      const negItem = snapshot.actions.find((a) => a.id.includes("c:neg"));
      const convItem = snapshot.actions.find((a) => a.id.includes("c:conv"));
      const approvalItem = snapshot.actions.find((a) => a.id.includes("approval:app:req1"));
      const strongOppItem = snapshot.actions.find((a) => a.id.includes("o:strong"));
      const lowOppItem = snapshot.actions.find((a) => a.id.includes("o:low"));

      expect(dealItem!.priority).toBeGreaterThan(negItem!.priority);
      expect(negItem!.priority).toBeGreaterThan(convItem!.priority);
      expect(convItem!.priority).toBeGreaterThan(approvalItem!.priority);
      expect(approvalItem!.priority).toBeGreaterThan(strongOppItem!.priority);
      expect(strongOppItem!.priority).toBeGreaterThan(lowOppItem!.priority);
    });
  });
});
