import { analyzeClient } from "../domain/client-intelligence.js";
import type { ClientRecord, ConversationMessage } from "../domain/client.js";
import { prepareConversationDecision, type ConversationDecision } from "../domain/conversation.js";
import type { CandidateProfile, Opportunity, RiskResult } from "../domain/opportunity.js";
import type { ClientCrmPort } from "./client-crm.js";

function clientIdFor(opportunity: Opportunity): string {
  const identity = opportunity.client?.name?.trim().toLowerCase() || opportunity.sourceUrl;
  return `client:${opportunity.source}:${identity}`;
}

export async function captureOpportunityClient(crm: ClientCrmPort, opportunity: Opportunity, profile: CandidateProfile, risk: RiskResult, now = new Date().toISOString()): Promise<ClientRecord> {
  const intelligence = analyzeClient(opportunity, profile, risk);
  const id = clientIdFor(opportunity);
  const existing = await crm.getClient(id);
  const opportunityIds = [...new Set([...(existing?.opportunityIds ?? []), opportunity.id])];
  const record: ClientRecord = {
    id,
    opportunityIds,
    source: opportunity.source,
    sourceUrl: opportunity.sourceUrl,
    ...(opportunity.client?.name ? { name: opportunity.client.name } : {}),
    ...(opportunity.client?.country ? { country: opportunity.client.country } : {}),
    ...(typeof opportunity.client?.verified === "boolean" ? { verified: opportunity.client.verified } : {}),
    ...(typeof opportunity.client?.hireRate === "number" ? { hireRate: opportunity.client.hireRate } : {}),
    ...(typeof opportunity.client?.totalSpent === "number" ? { totalSpent: opportunity.client.totalSpent } : {}),
    stage: existing?.stage ?? (intelligence.priorityScore >= 70 ? "qualified" : "discovered"),
    fitScore: intelligence.fitScore,
    legitimacyScore: intelligence.legitimacyScore,
    priorityScore: intelligence.priorityScore,
    summary: `${opportunity.title} · ${intelligence.reasoning.join(" ")}`,
    needs: intelligence.needs,
    objections: intelligence.objections,
    approachAngle: intelligence.approachAngle,
    ...(typeof intelligence.suggestedPriceUsd === "number" ? { suggestedPriceUsd: intelligence.suggestedPriceUsd } : {}),
    ...(typeof intelligence.suggestedDeliveryDays === "number" ? { suggestedDeliveryDays: intelligence.suggestedDeliveryDays } : {}),
    nextAction: intelligence.nextAction,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await crm.upsertClient(record);
  if (!existing) await crm.addEvent({ id: `event:${id}:${now}:captured`, clientId: id, type: "client_captured", summary: `Captured from ${opportunity.source}: ${opportunity.title}`, createdAt: now });
  return record;
}

export async function recordInboundAndPrepareReply(crm: ClientCrmPort, clientId: string, opportunity: Opportunity, profile: CandidateProfile, body: string, channel = opportunity.source, now = new Date().toISOString()): Promise<ConversationDecision> {
  const client = await crm.getClient(clientId);
  if (!client) throw new Error(`Client not found: ${clientId}`);
  const message: ConversationMessage = { id: `message:${clientId}:${now}:in`, clientId, direction: "inbound", body, timestamp: now, channel };
  await crm.addMessage(message);
  await crm.addEvent({ id: `event:${clientId}:${now}:message`, clientId, type: "message_received", summary: body.slice(0, 240), createdAt: now });
  return prepareConversationDecision(message, client, opportunity, profile);
}
