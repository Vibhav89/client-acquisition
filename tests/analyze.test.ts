import { describe, expect, it } from "vitest";
import { analyzeOpportunity } from "../src/domain/analyze.js";
import type { CandidateProfile, Opportunity } from "../src/domain/opportunity.js";

const profile: CandidateProfile = {
  skills: ["TypeScript", "React", "Supabase", "AI"],
  evidence: [
    { skill: "TypeScript", evidence: "Production TypeScript applications", strength: 1 },
    { skill: "React", evidence: "Production React work", strength: 1 },
  ],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 10,
};

const baseOpportunity: Opportunity = {
  id: "job-1",
  source: "test",
  sourceUrl: "https://example.com/job-1",
  title: "React TypeScript AI developer",
  description: "Build a remote AI dashboard with Supabase.",
  skills: ["React", "TypeScript", "AI", "Supabase"],
  workMode: "remote",
  budget: { currency: "USD", min: 20, max: 35, unit: "hour" },
  status: "new",
  discoveredAt: "2026-09-07T00:00:00Z",
};

describe("analyzeOpportunity", () => {
  it("strongly matches a relevant remote USD opportunity", () => {
    const result = analyzeOpportunity(baseOpportunity, profile);
    expect(result.match.score).toBeGreaterThanOrEqual(75);
    expect(result.recommendation).toBe("apply");
    expect(result.risk.level).toBe("low");
  });

  it("blocks opportunities containing payment/deposit scam signals", () => {
    const result = analyzeOpportunity({
      ...baseOpportunity,
      description: "Pay a registration fee and deposit before starting.",
    }, profile);
    expect(result.risk.level).toBe("high");
    expect(result.recommendation).toBe("skip");
  });
});
