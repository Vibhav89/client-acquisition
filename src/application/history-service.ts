import type { SchedulerRunResult } from "../domain/scheduler.js";
import { createHistoryEvent, type EventHistoryPort } from "../domain/event-history.js";
import type { AutomationSnapshot } from "./automation-orchestrator.js";

export async function recordAutomationRun(
  history: EventHistoryPort,
  snapshot: AutomationSnapshot,
): Promise<void> {
  await history.append(createHistoryEvent({
    type: "radar_run",
    timestamp: snapshot.run.finishedAt,
    entityType: "automation_run",
    entityId: snapshot.run.finishedAt,
    summary: snapshot.run.error ? `Radar run failed: ${snapshot.run.error}` : "Radar run completed",
    metadata: {
      startedAt: snapshot.run.startedAt,
      finishedAt: snapshot.run.finishedAt,
      skipped: snapshot.run.skipped,
      error: snapshot.run.error,
      actionCount: snapshot.actions.length,
      pendingApprovals: snapshot.pendingApprovals,
      activeClients: snapshot.activeClients,
      qualifiedOpportunities: snapshot.qualifiedOpportunities,
      alertCount: snapshot.alerts.length,
    },
  }));
}

export async function recordSchedulerRun(
  history: EventHistoryPort,
  result: SchedulerRunResult,
): Promise<void> {
  await history.append(createHistoryEvent({
    type: result.error ? "system_error" : "scheduler_run",
    timestamp: result.finishedAt,
    entityType: "scheduler_run",
    entityId: result.finishedAt,
    summary: result.error ? `Scheduler error: ${result.error}` : result.skipped ? "Scheduler run skipped" : "Scheduler run completed",
    metadata: result,
  }));
}

export async function recordSystemError(
  history: EventHistoryPort,
  message: string,
  entityId = "system",
  now = new Date().toISOString(),
): Promise<void> {
  await history.append(createHistoryEvent({
    type: "system_error",
    timestamp: now,
    entityType: "system",
    entityId,
    summary: message,
  }));
}
