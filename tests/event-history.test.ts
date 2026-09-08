import { describe, expect, it } from "vitest";
import { createHistoryEvent, InMemoryEventHistory } from "../src/domain/event-history.js";

describe("event history", () => {
  it("deduplicates events by id and returns chronological history", async () => {
    const history = new InMemoryEventHistory();
    await history.append(createHistoryEvent({
      id: "b",
      type: "approval_created",
      timestamp: "2026-09-08T10:02:00.000Z",
      entityType: "approval",
      entityId: "a1",
      summary: "Approval created",
    }));
    await history.append(createHistoryEvent({
      id: "a",
      type: "opportunity_discovered",
      timestamp: "2026-09-08T10:01:00.000Z",
      entityType: "opportunity",
      entityId: "o1",
      source: "remoteok",
      summary: "Opportunity discovered",
    }));
    await history.append(createHistoryEvent({
      id: "a",
      type: "system_error",
      timestamp: "2026-09-08T10:03:00.000Z",
      entityType: "system",
      entityId: "x",
      summary: "Duplicate id must be ignored",
    }));

    const events = await history.list();
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.id)).toEqual(["a", "b"]);
  });

  it("supports entity, type, source and time filters", async () => {
    const history = new InMemoryEventHistory();
    await history.append(createHistoryEvent({
      id: "1",
      type: "opportunity_discovered",
      timestamp: "2026-09-08T09:00:00.000Z",
      entityType: "opportunity",
      entityId: "o1",
      source: "remoteok",
      summary: "Remote opportunity",
    }));
    await history.append(createHistoryEvent({
      id: "2",
      type: "opportunity_scored",
      timestamp: "2026-09-08T11:00:00.000Z",
      entityType: "opportunity",
      entityId: "o1",
      source: "remotive",
      summary: "Scored opportunity",
    }));

    const events = await history.list({
      entityType: "opportunity",
      entityId: "o1",
      source: "remotive",
      since: "2026-09-08T10:00:00.000Z",
      type: "opportunity_scored",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("2");
  });
});
