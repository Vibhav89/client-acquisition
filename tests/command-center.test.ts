import { describe, expect, it } from "vitest";
import { buildCommandCenterSnapshot } from "../src/application/command-center.js";
import type { ClientRecord } from "../src/domain/client.js";

const client = (stage: ClientRecord["stage"], updatedAt: string): ClientRecord => ({
  id: `client:${stage}`,
  opportunityIds: ["o1"],
  source: "test",
  sourceUrl: "https://example.com/job/1",
  stage,
  fitScore: 85,
  legitimacyScore: 90,
  priorityScore: 88,
  summary: "Test client",
  needs: [],
  objections: [],
  approachAngle: "Relevant experience",
  nextAction: stage === "replied" ? "Reply to client" : "Continue discussion",
  createdAt: updatedAt,
  updatedAt,
});

describe("command center", () => {
  it("does not create a follow-up before its due time", () => {
    const snapshot = buildCommandCenterSnapshot({
      clients: [client("approached", "2026-09-08T10:00:00.000Z")],
      opportunities: [],
      now: "2026-09-11T09:59:59.000Z",
    });
    expect(snapshot.dueFollowUps).toBe(0);
    expect(snapshot.actions.some((action) => action.type === "follow_up")).toBe(false);
  });

  it("creates exactly one due follow-up action when the window expires", () => {
    const snapshot = buildCommandCenterSnapshot({
      clients: [client("approached", "2026-09-08T10:00:00.000Z")],
      opportunities: [],
      now: "2026-09-11T10:00:00.000Z",
    });
    expect(snapshot.dueFollowUps).toBe(1);
    expect(snapshot.actions.filter((action) => action.type === "follow_up")).toHaveLength(1);
    expect(snapshot.actions.find((action) => action.type === "follow_up")?.requiresUserApproval).toBe(true);
  });

  it("treats active conversation and negotiation as reply actions", () => {
    const snapshot = buildCommandCenterSnapshot({
      clients: [client("conversation", "2026-09-08T10:00:00.000Z"), client("negotiation", "2026-09-08T10:00:00.000Z")],
      opportunities: [],
      now: "2026-09-08T11:00:00.000Z",
    });
    expect(snapshot.actions.filter((action) => action.type === "reply")).toHaveLength(2);
    expect(snapshot.actions.every((action) => action.requiresUserApproval)).toBe(true);
  });
});
