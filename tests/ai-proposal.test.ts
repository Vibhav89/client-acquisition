import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider, readAiProviderConfig } from "../src/integrations/ai-provider.js";
import { generateAiProposal } from "../src/application/ai-proposal-service.js";
import type { Opportunity } from "../src/domain/opportunity.js";

const opportunity: Opportunity = {
  id: "op-1", source: "test", sourceUrl: "https://example.com/job/1",
  title: "Landing page build", description: "Build a responsive landing page.",
  skills: ["React"], workMode: "remote", status: "new", discoveredAt: "2026-01-01T00:00:00.000Z",
};

describe("AI provider configuration", () => {
  it("remains disabled when key or model is missing", () => {
    expect(readAiProviderConfig({ AI_API_KEY: "key" } as NodeJS.ProcessEnv)).toBeUndefined();
    expect(readAiProviderConfig({ AI_MODEL: "model" } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("requires HTTPS for remote providers", () => {
    expect(() => readAiProviderConfig({
      AI_API_KEY: "key", AI_MODEL: "model", AI_BASE_URL: "http://provider.example",
    } as NodeJS.ProcessEnv)).toThrow("must use HTTPS");
  });
});

describe("OpenAI-compatible provider", () => {
  it("sends the configured model and returns assistant content", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "A suitable proposal response with enough detail." } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const provider = new OpenAiCompatibleProvider({
      apiKey: "secret", baseUrl: "https://api.example/v1", model: "test-model",
    }, request);
    const result = await provider.complete([{ role: "user", content: "hello" }]);
    expect(result).toContain("suitable proposal");
    expect(request).toHaveBeenCalledWith("https://api.example/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    }));
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).model).toBe("test-model");
  });

  it("does not expose provider response bodies on errors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("private provider diagnostic", { status: 429 }));
    const provider = new OpenAiCompatibleProvider({
      apiKey: "secret", baseUrl: "https://api.example/v1", model: "test-model",
    }, request);
    await expect(provider.complete([{ role: "user", content: "hello" }])).rejects.toThrow("HTTP 429");
    await expect(provider.complete([{ role: "user", content: "hello" }])).rejects.not.toThrow("private provider diagnostic");
  });
});

describe("AI proposal generation", () => {
  it("returns sanitized proposal text and uses profile evidence", async () => {
    const complete = vi.fn().mockResolvedValue("Hello. I can build this React landing page with a responsive layout and clear delivery milestones. Let's confirm the scope. Best regards.");
    const result = await generateAiProposal({ complete }, opportunity, {
      skills: ["React"],
      evidence: [{ skill: "React", evidence: "Built a React dashboard", strength: 80 }],
      preferredWorkModes: ["remote"],
    });
    expect(result).toContain("responsive layout");
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0]?.[0][1].content).toContain("Built a React dashboard");
  });
});
