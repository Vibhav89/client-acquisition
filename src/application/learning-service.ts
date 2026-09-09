import { applyLearningBoost, eventFromClientOutcome, type LearningPort, type Outcome } from "../domain/learning.js";
import type { ClientRecord } from "../domain/client.js";

export async function recordClientOutcome(store: LearningPort, client: ClientRecord, outcome: Extract<Outcome, "won" | "lost">, reason: string, opportunityId?: string, now = new Date().toISOString()): Promise<void> {
  await store.save(eventFromClientOutcome(client, outcome, reason, opportunityId, now));
}

export async function adjustPriorityScore(store: LearningPort, client: ClientRecord): Promise<number> {
  const events = await store.list();
  return applyLearningBoost(client.priorityScore, client.source, events);
}
