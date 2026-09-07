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

  it("does not expose filesystem paths through traversal attempts", async () => {
    const base = await startServer();
    const response = await fetch(`${base}/../package.json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});
