import type { ApprovalRequest } from "../domain/approval.js";
import { buildActionQueue, type ActionItem } from "../domain/action-queue.js";
import type { ClientRecord } from "../domain/client.js";
import { planFollowUp, type FollowUpPolicy } from "../domain/follow-up.js";
import type { RankedOpportunity } from "../domain/rank.js";
import type { SchedulerState } from "../domain/scheduler.js";

export interface CommandCenterSnapshot {
  actions: ActionItem[];
  pendingApprovals: number;
  activeClients: number;
  qualifiedOpportunities: number;
  dueFollowUps: number;
  scheduler?: SchedulerState | undefined;
  generatedAt: string;
}

export function buildCommandCenterSnapshot(input: {
  clients: readonly ClientRecord[];
  opportunities: readonly RankedOpportunity[];
  approvals?: readonly ApprovalRequest[] | undefined;
  scheduler?: SchedulerState | undefined;
  now?: string | undefined;
  followUpPolicy?: Partial<FollowUpPolicy> | undefined;
}): CommandCenterSnapshot {
  const generatedAt = input.now ?? new Date().toISOString();
  const approvals = input.approvals ?? [];
  const dueFollowUps = input.clients.filter((client) => planFollowUp(client, generatedAt, input.followUpPolicy).shouldFollowUp);
  const baseActions = buildActionQueue(input.clients, input.opportunities, approvals, generatedAt);
  const followUpActions: ActionItem[] = dueFollowUps.map((client) => {
    const plan = planFollowUp(client, generatedAt, input.followUpPolicy);
    return {
      id: `followup:${client.id}:${plan.dueAt}`,
      type: "follow_up",
      title: "Follow-up due",
      summary: plan.message,
      priority: plan.priority === "high" ? 86 : plan.priority === "normal" ? 68 : 50,
      clientId: client.id,
      source: client.source,
      sourceUrl: client.sourceUrl,
      requiresUserApproval: true,
      createdAt: generatedAt,
    };
  });
  return {
    actions: [...baseActions, ...followUpActions].sort((a, b) => b.priority - a.priority || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    pendingApprovals: approvals.filter((a) => a.state === "pending").length,
    activeClients: input.clients.filter((c) => !["lost", "review"].includes(c.stage)).length,
    qualifiedOpportunities: input.opportunities.filter((o) => o.analysis.recommendation !== "skip").length,
    dueFollowUps: dueFollowUps.length,
    ...(input.scheduler ? { scheduler: input.scheduler } : {}),
    generatedAt,
  };
}
