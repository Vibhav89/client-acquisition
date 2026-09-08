import type { ClientRecord } from "./client.js";

export type FollowUpPriority = "high" | "normal" | "low";

export interface FollowUpPlan {
  shouldFollowUp: boolean;
  dueAt?: string;
  priority: FollowUpPriority;
  message: string;
  reason: string;
  requiresUserApproval: boolean;
}

export interface FollowUpPolicy {
  replyAfterHours: number;
  conversationAfterHours: number;
  approachedAfterHours: number;
  maxAgeDays: number;
}

const DEFAULT_POLICY: FollowUpPolicy = {
  replyAfterHours: 24,
  conversationAfterHours: 48,
  approachedAfterHours: 72,
  maxAgeDays: 14,
};

export function planFollowUp(client: ClientRecord, now = new Date().toISOString(), policy: Partial<FollowUpPolicy> = {}): FollowUpPlan {
  const resolved = { ...DEFAULT_POLICY, ...policy };
  const updated = Date.parse(client.updatedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(updated) || !Number.isFinite(current)) throw new Error("Follow-up timestamps must be valid ISO dates");
  if (current < updated) return { shouldFollowUp: false, priority: "low", message: "", reason: "Client update is in the future.", requiresUserApproval: true };

  const ageDays = (current - updated) / 86_400_000;
  if (ageDays > resolved.maxAgeDays) return { shouldFollowUp: false, priority: "low", message: "", reason: "Follow-up window has expired.", requiresUserApproval: true };

  let delayHours: number | undefined;
  let priority: FollowUpPriority = "normal";
  let message = "";
  let reason = "";

  if (client.stage === "replied") {
    delayHours = resolved.replyAfterHours;
    priority = "high";
    message = "Just following up on the details I shared. If the project is still active, I can clarify scope, timeline, or the next step.";
    reason = "Client has replied and is awaiting a timely response/follow-up.";
  } else if (client.stage === "conversation" || client.stage === "negotiation") {
    delayHours = resolved.conversationAfterHours;
    priority = "high";
    message = "Checking in on the project discussion. If you have any remaining questions or changes to the scope, I’m happy to clarify them.";
    reason = "An active conversation or negotiation has gone quiet.";
  } else if (client.stage === "approached") {
    delayHours = resolved.approachedAfterHours;
    priority = "normal";
    message = "Following up to see whether this project is still a priority. I can answer questions or clarify the proposed approach if helpful.";
    reason = "Initial approach has not received a response.";
  } else {
    return { shouldFollowUp: false, priority: "low", message: "", reason: `Stage ${client.stage} does not require a follow-up.`, requiresUserApproval: true };
  }

  const dueAt = new Date(updated + delayHours * 3_600_000).toISOString();
  return {
    shouldFollowUp: current >= Date.parse(dueAt),
    dueAt,
    priority,
    message,
    reason,
    requiresUserApproval: true,
  };
}
