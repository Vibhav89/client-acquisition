import { describe, expect, it } from "vitest";
import { runRadar } from "../src/domain/radar.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import { buildDashboardModel } from "../src/application/dashboard.js";

const opportunity = (id: string, description: string, skills: string[]): Opportunity => ({
  id,
  source: "test",
  sourceUrl: `https://example.com/${id}`,
  title: `Job ${id}`,
  description,
  skills,
  workMode: "remote",
  budget: { currency: "USD", min: 20, max: 30, unit: "hour" },
  status: "new",
  discoveredAt: "2026-09-07T00:00:00.000Z",
});

describe("buildDashboardModel", () => {
  it("builds a sorted dashboard summary from radar output", () => {
    const radar = runRadar([
      opportunity("low", "Remote TypeScript Python work", ["TypeScript", "Python"]),
      opportunity("high", "Remote TypeScript React AI work", ["TypeScript", "React", "AI"]),
      opportunity("skip", "Pay a registration fee for logo work", ["Photoshop"]),
    ], defaultCandidateProfile);
    const model = buildDashboardModel(radar);

    expect(model.summary.discovered).toBe(3);
    expect(model.summary.qualified).toBeGreaterThanOrEqual(1);
    expect(model.summary.skipped).toBeGreaterThanOrEqual(1);
    expect(model.opportunities.map((item) => item.id)).toEqual(["high", "low", "skip"]);
    expect(model.opportunities[0]?.budgetLabel).toBe("USD 20-30/hour");
  });
});
