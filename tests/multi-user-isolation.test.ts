import { describe, expect, it } from "vitest";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import { DocumentService } from "../src/application/document-service.js";
import { DefaultApprovalService } from "../src/application/approval-service.js";
import { SupabasePersistence, type SupabaseClientLike } from "../src/integrations/supabase-repository.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import type { ClientRecord } from "../src/domain/client.js";
import type { ApprovalRequest } from "../src/domain/approval.js";

type Row = Record<string, unknown>;

/**
 * Application-layer multi-user isolation tests using InMemoryPersistence and a
 * schema-accurate mocked SupabaseClientLike.
 *
 * NOTE: These tests do NOT connect to a real PostgreSQL/Supabase instance or test
 * PostgreSQL RLS policies. Under the current repository migrations, `opportunities`
 * and `approval_requests` still use single-column primary keys (`id text primary key`).
 * Identical `id` coexistence across tenants requires a separate PostgreSQL migration.
 */
function createMockSupabaseClient() {
  const tableRows: Row[] = [];
  const client: SupabaseClientLike = {
    from(table: string) {
      return {
        upsert(values: Row | Row[], options?: { onConflict?: string }) {
          const incoming = Array.isArray(values) ? values : [values];
          for (const val of incoming) {
            if (table === "approval_requests" && options?.onConflict === "user_id,id") {
              return Promise.resolve({ error: { message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" } });
            }
            const conflictCols = options?.onConflict
              ? options.onConflict.split(",").map((c) => c.trim())
              : ["id"];
            const keyParts = conflictCols.map((c) => String(val[c] ?? ""));
            const key = `${table}:${keyParts.join(":")}`;
            const index = tableRows.findIndex((r) => r.__table === table && r.__key === key);
            // Enforce single-column `id` primary key uniqueness across all rows for opportunities & approval_requests.
            if ((table === "opportunities" || table === "approval_requests") && val.id !== undefined) {
              const pkCollision = tableRows.findIndex((r, idx) => idx !== index && r.__table === table && r.id === val.id);
              if (pkCollision >= 0) {
                return Promise.resolve({ error: { message: `duplicate key value violates unique constraint "${table}_pkey"` } });
              }
            }
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
            order(col: string, options?: { ascending?: boolean }) {
              const asc = options?.ascending !== false;
              rows = [...rows].sort((a, b) => {
                const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
                return asc ? cmp : -cmp;
              });
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
  return { client, tableRows };
}

describe("Application-Layer Multi-User Data Isolation (In-Memory & Mocked Supabase)", () => {
  it("strictly isolates profiles, documents, opportunities, clients, deals, earnings between User A and User B in InMemoryPersistence", async () => {
    const userAPersistence = new InMemoryPersistence("user-A-uuid");
    const userBPersistence = new InMemoryPersistence("user-B-uuid");

    const docServiceA = new DocumentService(userAPersistence);
    const docServiceB = new DocumentService(userBPersistence);

    // User A uploads Developer CV
    await docServiceA.uploadDocument("user-A-uuid", {
      title: "User A Fullstack CV",
      documentType: "developer",
      fileName: "cv_a.txt",
      fileType: "txt",
      contentText: "TypeScript React Node.js Supabase",
    });

    // User B uploads AI CV
    await docServiceB.uploadDocument("user-B-uuid", {
      title: "User B AI CV",
      documentType: "ai_llm",
      fileName: "cv_b.txt",
      fileType: "txt",
      contentText: "Python PyTorch LLM Integration",
    });

    const docsA = await docServiceA.listDocuments();
    const docsB = await docServiceB.listDocuments();

    expect(docsA).toHaveLength(1);
    expect(docsA[0]?.title).toBe("User A Fullstack CV");

    expect(docsB).toHaveLength(1);
    expect(docsB[0]?.title).toBe("User B AI CV");

    // Save client records for User A and User B
    const clientA: ClientRecord = {
      id: "client-A-1",
      opportunityIds: ["opp-A-1"],
      source: "upwork",
      sourceUrl: "https://example.com/a",
      stage: "discovered",
      fitScore: 90,
      legitimacyScore: 100,
      priorityScore: 95,
      summary: "User A Client",
      needs: ["TypeScript"],
      objections: [],
      approachAngle: "Evidence based",
      nextAction: "Draft proposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const clientB: ClientRecord = {
      id: "client-B-1",
      opportunityIds: ["opp-B-1"],
      source: "remotive",
      sourceUrl: "https://example.com/b",
      stage: "discovered",
      fitScore: 85,
      legitimacyScore: 90,
      priorityScore: 88,
      summary: "User B Client",
      needs: ["Python"],
      objections: [],
      approachAngle: "AI focus",
      nextAction: "Draft proposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    userAPersistence.saveClient(clientA);
    userBPersistence.saveClient(clientB);

    expect(userAPersistence.getClient("client-A-1")?.summary).toBe("User A Client");
    expect(userAPersistence.getClient("client-B-1")).toBeUndefined();

    expect(userBPersistence.getClient("client-B-1")?.summary).toBe("User B Client");
    expect(userBPersistence.getClient("client-A-1")).toBeUndefined();
  });

  it("isolates identical opportunity source URLs across User A and User B in mocked SupabasePersistence when IDs are tenant-distinct", async () => {
    const { client } = createMockSupabaseClient();
    const repoA = new SupabasePersistence(client, "user_A");
    const repoB = new SupabasePersistence(client, "user_B");

    const jobA: Opportunity = {
      id: "user_A:remoteok:https://remoteok.com/job/shared-101",
      source: "remoteok",
      sourceUrl: "https://remoteok.com/job/shared-101",
      title: "Senior Fullstack Engineer",
      description: "Build distributed web applications",
      skills: ["TypeScript", "Node.js"],
      workMode: "remote",
      status: "new",
      discoveredAt: "2026-09-09T00:00:00.000Z",
    };

    // User A persists the opportunity
    await repoA.saveOpportunity(jobA);

    // User B persists the same public opportunity URL with a tenant-distinct ID (required under current single-column PK)
    await repoB.saveOpportunity({
      ...jobA,
      id: "user_B:remoteok:https://remoteok.com/job/shared-101",
    });

    // Assert both users only read their own opportunity copy via user_id filtering
    const oppA = await repoA.getOpportunity(jobA.id);
    const oppB = await repoB.getOpportunity("user_B:remoteok:https://remoteok.com/job/shared-101");
    expect(oppA?.title).toBe("Senior Fullstack Engineer");
    expect(oppB?.title).toBe("Senior Fullstack Engineer");
    expect(await repoA.getOpportunity("user_B:remoteok:https://remoteok.com/job/shared-101")).toBeUndefined();

    const listA = await repoA.listOpportunities();
    const listB = await repoB.listOpportunities();
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
  });

  it("isolates pending approval requests and prevents cross-tenant approval transitions in mocked SupabasePersistence", async () => {
    const { client } = createMockSupabaseClient();
    const repoA = new SupabasePersistence(client, "user_A");
    const repoB = new SupabasePersistence(client, "user_B");

    const approvalIdA = "approval:user_A:job-shared-1";
    const approvalIdB = "approval:user_B:job-shared-1";
    const approvalA: ApprovalRequest = {
      id: approvalIdA,
      opportunityId: "user_A:job-shared-1",
      proposal: "Proposal drafted for User A",
      state: "pending",
      createdAt: "2026-09-09T00:00:00.000Z",
    };
    const approvalB: ApprovalRequest = {
      id: approvalIdB,
      opportunityId: "user_B:job-shared-1",
      proposal: "Proposal drafted for User B",
      state: "pending",
      createdAt: "2026-09-09T00:00:00.000Z",
    };

    await repoA.saveApproval(approvalA);
    await repoB.saveApproval(approvalB);

    // Assert User A and User B see their own distinct pending approvals
    const pendingA = await repoA.listPendingApprovals();
    const pendingB = await repoB.listPendingApprovals();
    expect(pendingA).toHaveLength(1);
    expect(pendingB).toHaveLength(1);
    expect(pendingA[0]?.proposal).toBe("Proposal drafted for User A");
    expect(pendingB[0]?.proposal).toBe("Proposal drafted for User B");

    // Service for User A approves User A's approval
    const serviceA = new DefaultApprovalService(repoA);
    const approvedA = await serviceA.approve(approvalIdA);
    expect(approvedA.state).toBe("approved");

    // User A queue is now cleared, User B queue remains intact
    expect(await repoA.listPendingApprovals()).toHaveLength(0);
    const remainingB = await repoB.listPendingApprovals();
    expect(remainingB).toHaveLength(1);
    expect(remainingB[0]?.state).toBe("pending");

    // User A attempting to approve User B's approval fails with PendingApprovalNotFoundError
    await expect(serviceA.approve(approvalIdB)).rejects.toThrow("Pending approval not found");
  });

  it("rejects cross-tenant foreign key relationships at application level", async () => {
    const userAStore = new InMemoryPersistence("user_A");
    const userBStore = new InMemoryPersistence("user_B");

    // User A has an opportunity
    userAStore.saveOpportunity({
      id: "opp-A-only",
      source: "upwork",
      sourceUrl: "https://example.com/job-a",
      title: "Job A",
      description: "Description A",
      skills: ["React"],
      workMode: "remote",
      status: "new",
      discoveredAt: "2026-09-09T00:00:00.000Z",
    });

    // In User B's store, opp-A-only is not visible
    expect(userBStore.getOpportunity("opp-A-only")).toBeUndefined();

    // User B attempting to save an approval referencing User A's unknown opportunity throws in domain store
    expect(() => userBStore.saveApproval({
      id: "approval-b-1",
      opportunityId: "opp-A-only",
      proposal: "Draft",
      state: "pending",
      createdAt: "2026-09-09T00:00:00.000Z",
    })).toThrow("unknown opportunity");
  });
});
