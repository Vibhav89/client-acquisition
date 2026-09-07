import { describe, expect, it } from "vitest";
import { discoverAndAnalyze, type OpportunitySource } from "../src/application/radar-service.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import type { RawOpportunity } from "../src/domain/normalizer.js";

const rawJob: RawOpportunity = {
  id: "remote-ai-1",
  source: "fixture",
  url: "https://example.com/job",
  title: "TypeScript React AI engineer",
  description: "Build an AI product remotely.",
  skills: ["TypeScript", "React", "AI"],
  workMode: "remote",
  currency: "USD",
  min: 20,
  max: 40,
  unit: "hour",
};

describe("discoverAndAnalyze", () => {
  it("continues when one source fails", async () => {
    const good: OpportunitySource = { name: "good", fetch: async () => [rawJob] };
    const bad: OpportunitySource = { name: "bad", fetch: async () => { throw new Error("temporary outage"); } };

    const result = await discoverAndAnalyze([bad, good], defaultCandidateProfile);
    expect(result.discovered).toBe(1);
    expect(result.reports.find((report) => report.source === "bad")?.failed).toBe(true);
    expect(result.ranked[0]?.opportunity.id).toBe("remote-ai-1");
  });
});
