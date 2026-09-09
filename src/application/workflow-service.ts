import type { ClientRecord, ClientStage, ConversationMessage } from "../domain/client.js";
import { transitionClientStage, type ClientCrmPort } from "./client-crm.js";
import { recordInboundAndPrepareReply } from "./client-service.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { EventHistoryPort } from "../domain/event-history.js";

export async function listClientWorkflow(crm: ClientCrmPort): Promise<ClientRecord[]> { return crm.listClients(); }

export async function advanceClientWorkflow(crm: ClientCrmPort, clientId: string, toStage: ClientStage, summary: string, history?: EventHistoryPort, now = new Date().toISOString()): Promise<ClientRecord> {
  return transitionClientStage(crm, clientId, toStage, summary, now, history);
}

export async function receiveClientMessage(crm: ClientCrmPort, clientId: string, opportunity: Opportunity, profile: CandidateProfile | PersonalAgentProfile, body: string, channel = opportunity.source, history?: EventHistoryPort, now = new Date().toISOString()) {
  const candidate: CandidateProfile = "negotiation" in profile ? { skills: profile.skills, evidence: profile.evidence, preferredWorkModes: profile.preferredWorkModes, minimumHourlyUsd: profile.negotiation.minimumHourlyUsd, minimumFixedUsd: profile.negotiation.minimumFixedUsd } : profile;
  return recordInboundAndPrepareReply(crm, clientId, opportunity, candidate, body, channel, now, history);
}

export function conversationTimeline(crm: ClientCrmPort, clientId: string): Promise<{ messages: ConversationMessage[]; events: Awaited<ReturnType<ClientCrmPort["listEvents"]>> }> {
  return Promise.all([Promise.resolve(crm.listMessages(clientId)), Promise.resolve(crm.listEvents(clientId))]).then(([messages, events]) => ({ messages, events }));
}
