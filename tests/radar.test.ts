import { describe, expect, it } from "vitest";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import { runRadar } from "../src/domain/radar.js";
import type { Opportunity } from "../src/domain/opportunity.js";

const opportunity = (id: string, description: string, skills: string[] = ["React", "TypeScript", "AI"]): Opportunity => ({
  id,
  source: "fixture",
  sourceUrl: `https://example.com/${id}`,
  title: "React TypeScript AI developer",
  description,
  skills,
  workMode: "remote",
  budget: { currency: "USD", min: 20, max: 40, unit: "hour" },
  status: "new",
  discoveredAt: "2026-09-07T00:00:00Z",
});

describe("client radar", () => {
  it("deduplicates, analyzes and ranks opportunities", () => {
    const result = runRadar([
      opportunity("good", "Build an AI dashboard."),
      opportunity("good", "duplicate record"),
      opportunity("scam", "Pay a registration fee before work starts."),
      { ...opportunity("poor", "Design a logo."), skills: ["Photoshop"], workMode: "onsite" },
    ], defaultCandidateProfile);

    expect(result.discovered).toBe(4);
    expect(result.analyzed).toBe(3);
    expect(result.qualified).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.ranked[0]?.opportunity.id).toBe("good");
    expect(result.ranked.find((item) => item.opportunity.id === "scam")?.analysis.risk.level).toBe("high");
  });
});
