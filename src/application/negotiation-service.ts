import type { ClientRecord, ConversationMessage } from "../domain/client.js";
import type { EventHistoryPort } from "../domain/event-history.js";
import { createHistoryEvent } from "../domain/event-history.js";
import { assessNegotiation, type NegotiationAssessment } from "../domain/negotiation-guardrails.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { Opportunity } from "../domain/opportunity.js";

export async function prepareNegotiationDecision(
  client: ClientRecord,
  opportunity: Opportunity,
  profile: PersonalAgentProfile,
  body: string,
  channel = client.source,
  now = new Date().toISOString(),
  history?: EventHistoryPort,
): Promise<NegotiationAssessment> {
  const message: ConversationMessage = {
    id: `message:${client.id}:${now}:negotiation`,
    clientId: client.id,
    direction: "inbound",
    body,
    timestamp: now,
    channel,
  };

  const assessment = assessNegotiation(message, client, profile);
  await history?.append(createHistoryEvent({
    type: "reply_prepared",
    timestamp: now,
    entityType: "client",
    entityId: client.id,
    source: channel,
    summary: `Negotiation response prepared: ${assessment.strategy}`,
    metadata: {
      intent: assessment.intent,
      signals: assessment.signals,
      confidence: assessment.confidence,
      strategy: assessment.strategy,
      riskScore: assessment.signals.length ? assessment.signals.filter((signal) => ["payment_risk", "off_platform_risk"].includes(signal)).length * 50 : 0,
      escalateToFinalApproval: assessment.escalateToFinalApproval,
    },
    requiresUserApproval: true,
  }));

  if (assessment.escalateToFinalApproval) {
    await history?.append(createHistoryEvent({
      type: "deal_reviewed",
      timestamp: now,
      entityType: "client",
      entityId: client.id,
      source: channel,
      summary: "Negotiation requires final user approval before commitment.",
      metadata: { intent: assessment.intent, signals: assessment.signals, strategy: assessment.strategy },
      requiresUserApproval: true,
    }));
  }

  return assessment;
}
