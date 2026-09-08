import { describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleRequest } from "../src/server.js";

describe("server master profile integration", () => {
  it("exposes the profile endpoint and keeps development fallback non-persistent", async () => {
    const server = createServer((req, res) => void handleRequest(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to resolve test server address");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/profile`);
      expect(response.status).toBe(200);
      const body = await response.json() as { configured: boolean; profile: unknown };
      expect(body.configured).toBe(false);
      expect(body.profile).toBeNull();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
