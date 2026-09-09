import { describe, expect, it } from "vitest";
import { generateDailyDigest } from "../src/domain/digest.js";
import type { RankedOpportunity } from "../src/domain/rank.js";

describe("generateDailyDigest", () => {
  it("generates a structured daily digest prioritizing top opportunities and actions", () => {
    const opps: RankedOpportunity[] = [
      {
        opportunity: { id: "o1", source: "upwork", sourceUrl: "u1", title: "TS Dev", description: "D", skills: ["TypeScript"], workMode: "remote", status: "new", discoveredAt: "now" },
        analysis: { match: { opportunityId: "o1", score: 85, matchedSkills: ["TypeScript"], missingSkills: [], evidenceScore: 20, budgetScore: 20, fitReasons: ["Fit TS"] }, risk: { level: "low", score: 0, signals: [] }, recommendation: "apply" },
        rankScore: 85,
      },
      {
        opportunity: { id: "o2", source: "upwork", sourceUrl: "u2", title: "Scam Job", description: "D", skills: ["Crypto"], workMode: "remote", status: "new", discoveredAt: "now" },
        analysis: { match: { opportunityId: "o2", score: 50, matchedSkills: [], missingSkills: [], evidenceScore: 0, budgetScore: 0, fitReasons: [] }, risk: { level: "high", score: 100, signals: ["Pay fee in bitcoin"] }, recommendation: "skip" },
        rankScore: 10,
      },
    ];

    const digest = generateDailyDigest({
      opportunities: opps,
      limit: 10,
    });

    expect(digest.summary.topOpportunitiesCount).toBe(1);
    expect(digest.summary.highRiskRejectionsCount).toBe(1);
    expect(digest.topOpportunities[0]?.title).toBe("TS Dev");
    expect(digest.highRiskRejections[0]?.title).toBe("Scam Job");
  });
});
