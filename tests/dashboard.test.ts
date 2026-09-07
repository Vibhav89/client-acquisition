import { describe, expect, it } from "vitest";
import type { CandidateProfile } from "../src/domain/opportunity.js";
import type { RadarResult } from "../src/domain/pipeline.js";
import { buildDashboardModel } from "../src/application/dashboard.js";

const profile: CandidateProfile = {
  skills: ["typescript", "react", "supabase"],
  evidence: [],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 10,
};

const result = (id: string, score: number, recommendation: "apply" | "review" | "skip"): RadarResult => ({
  opportunity: {
    id,
    source: "test",
    sourceUrl: `https://example.com/${id}`,
    title: `Job ${id}`,
    description: "Remote TypeScript work",
    skills: ["typescript"],
    workMode: "remote",
    budget: { currency: "USD", min: 20, max: 30, unit: "hour" },
    status: "new",
    discoveredAt: "2026-09-07T00:00:00.000Z",
  },
  analysis: {
    match: {
      opportunityId: id,
      score,
      matchedSkills: ["typescript"],
      missingSkills: [],
      evidenceScore: 90,
      budgetScore: 100,
      fitReasons: ["Strong skill match"],
    },
    risk: { level: recommendation === "skip" ? "high" : "low", score: recommendation === "skip" ? 90 : 10, signals: [] },
    recommendation,
  },
});

describe("buildDashboardModel", () => {
  it("builds a sorted dashboard summary without mutating input", () => {
    const input = [result("low", 70, "review"), result("high", 95, "apply"), result("skip", 20, "skip")];
    const model = buildDashboardModel(input);

    expect(model.summary).toEqual({
      discovered: 3,
      qualified: 1,
      review: 1,
      skipped: 1,
      lowRisk: 2,
      pendingProposalReview: 0,
    });
    expect(model.opportunities.map((item) => item.id)).toEqual(["high", "low", "skip"]);
    expect(model.opportunities[0]?.budgetLabel).toBe("USD 20-30/hour");
    expect(input.map((item) => item.opportunity.id)).toEqual(["low", "high", "skip"]);
  });
});

void profile;
