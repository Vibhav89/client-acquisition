import { describe, expect, it } from "vitest";
import { discoverAndAnalyze } from "../src/application/radar-service.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";

describe("radar source hardening", () => {
  it("isolates a failed source", async () => {
    const result = await discoverAndAnalyze([
      { name: "broken", discover: async () => { throw new Error("upstream unavailable"); } },
      { name: "healthy", discover: async () => [] },
    ], defaultCandidateProfile);

    expect(result.reports).toEqual([
      { source: "broken", discovered: 0, failed: true, error: "upstream unavailable" },
      { source: "healthy", discovered: 0, failed: false },
    ]);
  });

  it("times out a source instead of hanging the radar forever", async () => {
    const result = await discoverAndAnalyze([
      { name: "slow", discover: () => new Promise(() => undefined) },
    ], defaultCandidateProfile);

    expect(result.reports[0]).toMatchObject({ source: "slow", discovered: 0, failed: true, error: "Source request timed out" });
  }, 17_000);
});
