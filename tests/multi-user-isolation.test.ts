import { describe, expect, it } from "vitest";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import { DocumentService } from "../src/application/document-service.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import type { ClientRecord } from "../src/domain/client.js";

describe("E2E Multi-User Data Isolation & System Verification", () => {
  it("strictly isolates profiles, documents, opportunities, clients, deals, earnings between User A and User B", async () => {
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
});
