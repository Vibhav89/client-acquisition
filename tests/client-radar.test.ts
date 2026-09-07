import { describe, expect, it } from "vitest";
import { runClientRadar } from "../src/application/client-radar.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import type { Opportunity } from "../src/domain/opportunity.js";

const job: Opportunity = {
  id: "good-job",
  source: "fixture",
  sourceUrl: "https://example.com/good-job",
  title: "Remote React TypeScript AI developer",
  description: "Build an AI dashboard with React and TypeScript.",
  skills: ["React", "TypeScript", "AI"],
  workMode: "remote",
  budget: { currency: "USD", min: 25, max: 40, unit: "hour" },
  status: "new",
  discoveredAt: "2026-09-07T00:00:00Z",
};

const scam: Opportunity = {
  ...job,
  id: "scam-job",
  sourceUrl: "https://example.com/scam-job",
  title: "React developer",
  description: "Pay a registration fee before receiving the project.",
};

describe("runClientRadar", () => {
  it("persists discovered work and creates approval requests without sending anything", async () => {
    const persistence = new InMemoryPersistence();
    const source = { name: "fixture", discover: async () => [job, scam] };

    const run = await runClientRadar([source], defaultCandidateProfile, persistence, "2026-09-07T12:00:00Z");

    expect(run.dashboard.summary.discovered).toBe(2);
    expect(run.dashboard.summary.skipped).toBe(1);
    expect(run.approvals).toHaveLength(1);
    expect(run.approvals[0]?.state).toBe("pending");
    expect(persistence.listOpportunities()).toHaveLength(2);
    expect(persistence.listPendingApprovals()).toHaveLength(1);
  });
});
