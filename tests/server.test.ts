import { afterEach, describe, expect, it } from "vitest";
import { createAppServer } from "../src/server.js";

const servers: ReturnType<typeof createAppServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function startServer() {
  const server = createAppServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

describe("HTTP API", () => {
  it("returns a health response", async () => {
    const base = await startServer();
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value).toMatchObject({ ok: true, service: "client-acquisition" });
    expect(["development", "supabase"]).toContain(value.authentication);
  });

  it("rejects unknown API routes and non-GET static methods", async () => {
    const base = await startServer();
    const missing = await fetch(`${base}/api/does-not-exist`);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "API route not found" });

    const method = await fetch(`${base}/`, { method: "POST" });
    expect(method.status).toBe(405);
    await expect(method.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("rejects conversations and deals linked to unknown clients", async () => {
    const base = await startServer();
    const conversation = await fetch(`${base}/api/conversations`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "missing-client", body: "Hello" }),
    });
    expect(conversation.status).toBe(404);
    await expect(conversation.json()).resolves.toEqual({ error: "Client not found" });

    const deal = await fetch(`${base}/api/deals`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "missing-client", terms: { price: 100 } }),
    });
    expect(deal.status).toBe(404);
    await expect(deal.json()).resolves.toEqual({ error: "Client not found" });
  });

  it("rejects applications and earnings linked to unknown resources", async () => {
    const base = await startServer();
    const application = await fetch(`${base}/api/applications`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId: "missing-opportunity" }),
    });
    expect(application.status).toBe(404);
    await expect(application.json()).resolves.toEqual({ error: "Opportunity not found" });

    const earnings = await fetch(`${base}/api/earnings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectTitle: "Test", amount: 10, clientId: "missing-client" }),
    });
    expect(earnings.status).toBe(404);
    await expect(earnings.json()).resolves.toEqual({ error: "Client not found" });
  });

  it("rejects clients and learning events linked to unknown opportunities or clients", async () => {
    const base = await startServer();
    const headers = { "content-type": "application/json" };

    const client = await fetch(`${base}/api/clients`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "client-with-missing-opportunity",
        opportunityIds: ["missing-opportunity"],
        source: "test",
        sourceUrl: "https://example.com",
        summary: "Test client",
      }),
    });
    expect(client.status).toBe(404);
    await expect(client.json()).resolves.toEqual({ error: "Opportunity not found" });

    const learningClient = await fetch(`${base}/api/learning`, {
      method: "POST", headers,
      body: JSON.stringify({ outcome: "won", clientId: "missing-client" }),
    });
    expect(learningClient.status).toBe(404);
    await expect(learningClient.json()).resolves.toEqual({ error: "Client not found" });

    const learningOpportunity = await fetch(`${base}/api/learning`, {
      method: "POST", headers,
      body: JSON.stringify({ outcome: "lost", opportunityId: "missing-opportunity" }),
    });
    expect(learningOpportunity.status).toBe(404);
    await expect(learningOpportunity.json()).resolves.toEqual({ error: "Opportunity not found" });

    const invalidScore = await fetch(`${base}/api/learning`, {
      method: "POST", headers,
      body: JSON.stringify({ outcome: "won", matchScore: 140 }),
    });
    expect(invalidScore.status).toBe(400);
  });

  it("rejects malformed client and history payloads before persistence", async () => {
    const base = await startServer();
    const headers = { "content-type": "application/json" };

    const unsafeUrl = await fetch(`${base}/api/clients`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "bad-url", opportunityIds: ["opp-1"], source: "test", sourceUrl: "javascript:alert(1)", summary: "Client" }),
    });
    expect(unsafeUrl.status).toBe(400);
    await expect(unsafeUrl.json()).resolves.toMatchObject({ error: expect.stringContaining("safe HTTP(S)") });

    const invalidScore = await fetch(`${base}/api/clients`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "bad-score", opportunityIds: ["opp-1"], source: "test", sourceUrl: "https://example.com", summary: "Client", fitScore: 140 }),
    });
    expect(invalidScore.status).toBe(400);
    await expect(invalidScore.json()).resolves.toMatchObject({ error: expect.stringContaining("fitScore") });

    const invalidHistoryType = await fetch(`${base}/api/history`, {
      method: "POST", headers,
      body: JSON.stringify({ type: "arbitrary", entityType: "client", entityId: "c1", summary: "Test" }),
    });
    expect(invalidHistoryType.status).toBe(400);

    const invalidHistoryMetadata = await fetch(`${base}/api/history`, {
      method: "POST", headers,
      body: JSON.stringify({ type: "system_error", entityType: "system", entityId: "server", summary: "Test", metadata: [] }),
    });
    expect(invalidHistoryMetadata.status).toBe(400);
  });

  it("does not expose filesystem paths through traversal attempts", async () => {
    const base = await startServer();
    const response = await fetch(`${base}/../package.json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});
