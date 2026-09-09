import type { ClientRecord } from "../domain/client.js";
import { planFollowUp, type FollowUpPlan, type FollowUpPolicy } from "../domain/follow-up.js";
import type { EventHistoryPort } from "../domain/event-history.js";
import { createHistoryEvent } from "../domain/event-history.js";

export async function prepareDueFollowUps(
  clients: readonly ClientRecord[],
  now = new Date().toISOString(),
  policy: Partial<FollowUpPolicy> = {},
  history?: EventHistoryPort,
): Promise<Array<{ client: ClientRecord; plan: FollowUpPlan }>> {
  const due: Array<{ client: ClientRecord; plan: FollowUpPlan }> = [];
  for (const client of clients) {
    const plan = planFollowUp(client, now, policy);
    if (!plan.shouldFollowUp) continue;
    due.push({ client, plan });
    await history?.append(createHistoryEvent({
      type: "alert_created",
      timestamp: now,
      entityType: "client",
      entityId: client.id,
      source: client.source,
      summary: `Follow-up due: ${client.name ?? client.source}`,
      metadata: { dueAt: plan.dueAt, priority: plan.priority, reason: plan.reason },
      requiresUserApproval: true,
    }));
  }
  return due;
}
