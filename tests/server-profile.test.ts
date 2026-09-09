import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handleRequest } from "../src/server.js";

const validProfile = {
  id: "test-profile",
  displayName: "Test User",
  headline: "TypeScript developer",
  bio: "Builds TypeScript and React applications.",
  skills: ["TypeScript", "React"],
  evidence: [{ skill: "TypeScript", evidence: "Project work" }],
  preferredWorkModes: ["remote"],
  negotiation: {
    minimumHourlyUsd: 10,
    minimumFixedUsd: 3,
    preferredHourlyUsd: 20,
    preferredFixedUsd: 100,
    maxDiscountPercent: 10,
    requireScopeConfirmation: true,
    requireFinalApproval: true,
  },
  portfolio: [],
  services: [],
  platformAccounts: [],
  communicationStyle: "professional",
  redFlags: [],
  lastUpdatedAt: new Date().toISOString(),
};

describe("server master profile integration", () => {
  it("persists a valid development profile and returns it on GET", async () => {
    const server = createServer((req, res) => void handleRequest(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to resolve test server address");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const before = await fetch(`${base}/api/profile`);
      expect(before.status).toBe(200);
      expect((await before.json() as { configured: boolean }).configured).toBe(false);

      const save = await fetch(`${base}/api/profile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validProfile),
      });
      expect(save.status).toBe(200);
      const saved = await save.json() as { configured: boolean; profile: typeof validProfile };
      expect(saved.configured).toBe(true);
      expect(saved.profile.displayName).toBe("Test User");

      const after = await fetch(`${base}/api/profile`);
      const loaded = await after.json() as { configured: boolean; profile: typeof validProfile };
      expect(after.status).toBe(200);
      expect(loaded.configured).toBe(true);
      expect(loaded.profile.displayName).toBe("Test User");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects malformed profile payloads", async () => {
    const server = createServer((req, res) => void handleRequest(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to resolve test server address");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/profile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: "Missing required fields" }),
      });
      expect(response.status).toBe(400);
      expect((await response.json() as { error: string }).error).toContain("Invalid master profile");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
