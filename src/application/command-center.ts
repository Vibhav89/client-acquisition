import type { ApprovalRequest } from "../domain/approval.js";
import { buildActionQueue, type ActionItem } from "../domain/action-queue.js";
import type { ClientRecord } from "../domain/client.js";
import type { RankedOpportunity } from "../domain/rank.js";
import type { SchedulerState } from "../domain/scheduler.js";

export interface CommandCenterSnapshot {
  actions: ActionItem[];
  pendingApprovals: number;
  activeClients: number;
  qualifiedOpportunities: number;
  scheduler?: SchedulerState;
  generatedAt: string;
}

export function buildCommandCenterSnapshot(input: {
  clients: readonly ClientRecord[];
  opportunities: readonly RankedOpportunity[];
  approvals?: readonly ApprovalRequest[];
  scheduler?: SchedulerState;
  now?: string;
}): CommandCenterSnapshot {
  const generatedAt = input.now ?? new Date().toISOString();
  const approvals = input.approvals ?? [];
  return {
    actions: buildActionQueue(input.clients, input.opportunities, approvals, generatedAt),
    pendingApprovals: approvals.filter((a) => a.state === "pending").length,
    activeClients: input.clients.filter((c) => !["lost", "review"].includes(c.stage)).length,
    qualifiedOpportunities: input.opportunities.filter((o) => o.analysis.recommendation !== "skip").length,
    ...(input.scheduler ? { scheduler: input.scheduler } : {}),
    generatedAt,
  };
}
