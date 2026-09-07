import { describe, expect, it } from "vitest";
import { analyzeExisting } from "../src/application/radar.js";
import type { CandidateProfile, Opportunity } from "../src/domain/opportunity.js";

const profile: CandidateProfile = {
  skills: ["TypeScript", "React", "Next.js", "Supabase", "AI"],
  evidence: [
    { skill: "TypeScript", evidence: "Production TypeScript applications", strength: 1 },
    { skill: "React", evidence: "Production React applications", strength: 1 },
    { skill: "AI", evidence: "AI-assisted application workflows", strength: 0.8 },
  ],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 10,
};

const jobs: Opportunity[] = [
  {
    id: "good",
    source: "test",
    sourceUrl: "https://example.com/good",
    title: "React TypeScript AI dashboard",
    description: "Remote dashboard work with AI and Supabase.",
    skills: ["React", "TypeScript", "AI", "Supabase"],
    workMode: "remote",
    budget: { currency: "USD", min: 25, max: 40, unit: "hour" },
    status: "new",
    discoveredAt: "2026-09-07T00:00:00Z",
  },
  {
    id: "scam",
    source: "test",
    sourceUrl: "https://example.com/scam",
    title: "Developer needed",
    description: "Pay a registration fee and send money before starting.",
    skills: ["TypeScript"],
    workMode: "remote",
    budget: { currency: "USD", min: 50, max: 70, unit: "hour" },
    status: "new",
    discoveredAt: "2026-09-07T00:00:00Z",
  },
  {
    id: "weak",
    source: "test",
    sourceUrl: "https://example.com/weak",
    title: "Data entry",
    description: "Simple onsite data entry.",
    skills: ["Excel"],
    workMode: "onsite",
    budget: { currency: "USD", min: 5, max: 8, unit: "hour" },
    status: "new",
    discoveredAt: "2026-09-07T00:00:00Z",
  },
];

describe("simulated user radar flow", () => {
  it("ranks a good job, rejects a scam, and deprioritizes a poor fit", () => {
    const results = analyzeExisting(jobs, profile);
    expect(results[0]?.opportunity.id).toBe("good");
    expect(results.find((r) => r.opportunity.id === "scam")?.analysis.recommendation).toBe("skip");
    expect(results.find((r) => r.opportunity.id === "weak")?.analysis.recommendation).toBe("skip");
    expect(results[0]?.proposal?.body).toContain("TypeScript");
  });
});
