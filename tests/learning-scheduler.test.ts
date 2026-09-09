import { describe, expect, it } from "vitest";
import { InMemoryLearningStore, summarizeLearning, applyLearningBoost, type LearningEvent } from "../src/domain/learning.js";
import { LocalRadarScheduler } from "../src/domain/scheduler.js";

const event = (outcome: LearningEvent["outcome"], source = "upwork"): LearningEvent => ({
  id: `${source}:${outcome}:${Math.random()}`,
  source,
  outcome,
  createdAt: new Date().toISOString(),
  matchScore: 80,
  riskScore: 10,
});

describe("learning engine", () => {
  it("summarizes wins and losses by source", () => {
    const events = [event("won"), event("won"), event("lost"), event("rejected"), event("ignored")];
    const summary = summarizeLearning(events, "upwork");
    expect(summary).toMatchObject({ total: 5, wins: 2, losses: 2, winRate: 0.4 });
    expect(summary.averageMatchScore).toBe(80);
    expect(summary.averageRiskScore).toBe(10);
  });

  it("only applies a source learning boost after enough history", () => {
    const few = [event("won"), event("won")];
    expect(applyLearningBoost(70, "upwork", few)).toBe(70);

    const many = [event("won"), event("won"), event("won"), event("won"), event("lost")];
    expect(applyLearningBoost(70, "upwork", many)).toBe(76);
  });
});

describe("local radar scheduler", () => {
  it("prevents overlapping runs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const scheduler = new LocalRadarScheduler({ intervalMs: 60_000, onRun: async () => { calls += 1; await gate; } });

    const first = scheduler.runNow();
    const second = await scheduler.runNow();
    expect(second.skipped).toBe(true);
    expect(calls).toBe(1);
    release();
    await first;
    expect(scheduler.getState().runCount).toBe(1);
  });

  it("records failures without throwing to the scheduler caller", async () => {
    const scheduler = new LocalRadarScheduler({ intervalMs: 60_000, onRun: async () => { throw new Error("scan failed"); } });
    const result = await scheduler.runNow();
    expect(result.error).toBe("scan failed");
    expect(scheduler.getState()).toMatchObject({ running: false, runCount: 1, lastError: "scan failed" });
  });
});
