import type { ApprovalRequest } from "../domain/approval.js";
import type { ClientRecord } from "../domain/client.js";
import type { EventHistoryPort } from "../domain/event-history.js";
import { toCandidateProfile, type PersonalAgentProfile } from "../domain/master-profile.js";
import type { Opportunity } from "../domain/opportunity.js";
import type { RiskResult } from "../domain/risk.js";
import type { ProposalDraft } from "../domain/proposal.js";
import { draftProposal } from "../domain/proposal.js";
import type { ProfilePersistencePort } from "../domain/profile-persistence.js";
import type { OpportunitySource } from "./radar-service.js";
import { discoverAndAnalyze, type RadarRunResult } from "./radar-service.js";
import type { PersistencePort } from "../domain/persistence.js";
import { DefaultApprovalService } from "./approval-service.js";
import type { ClientCrmPort } from "./client-crm.js";
import { captureOpportunityClient } from "./client-service.js";
import { prepareNegotiationDecision } from "./negotiation-service.js";
import type { NegotiationAssessment } from "../domain/negotiation-guardrails.js";

export async function loadAgentProfile(profileStore: ProfilePersistencePort): Promise<PersonalAgentProfile> {
  const profile = await profileStore.getProfile();
  if (!profile) throw new Error("Master profile has not been configured");
  return profile;
}

export async function runRadarWithMasterProfile(
  sources: readonly OpportunitySource[],
  profileStore: ProfilePersistencePort,
): Promise<RadarRunResult & { profile: PersonalAgentProfile }> {
  const profile = await loadAgentProfile(profileStore);
  const result = await discoverAndAnalyze(sources, toCandidateProfile(profile));
  return { ...result, profile };
}

export async function createApprovalQueueFromMasterProfile(
  result: RadarRunResult,
  profileStore: ProfilePersistencePort,
  persistence: PersistencePort,
  now = new Date().toISOString(),
): Promise<ApprovalRequest[]> {
  const profile = await loadAgentProfile(profileStore);
  const approvalService = new DefaultApprovalService(persistence);
  return approvalService.createForRadar(result, toCandidateProfile(profile), now);
}

export async function draftProposalFromMasterProfile(
  opportunity: Opportunity,
  profileStore: ProfilePersistencePort,
): Promise<ProposalDraft> {
  const profile = await loadAgentProfile(profileStore);
  return draftProposal(opportunity, profile);
}

export async function captureClientFromMasterProfile(
  crm: ClientCrmPort,
  opportunity: Opportunity,
  risk: RiskResult,
  profileStore: ProfilePersistencePort,
  now = new Date().toISOString(),
  history?: EventHistoryPort,
): Promise<ClientRecord> {
  const profile = await loadAgentProfile(profileStore);
  return captureOpportunityClient(crm, opportunity, profile, risk, now, history);
}

export async function prepareNegotiationFromMasterProfile(
  client: ClientRecord,
  opportunity: Opportunity,
  body: string,
  profileStore: ProfilePersistencePort,
  channel = client.source,
  now = new Date().toISOString(),
  history?: EventHistoryPort,
): Promise<NegotiationAssessment> {
  const profile = await loadAgentProfile(profileStore);
  return prepareNegotiationDecision(client, opportunity, profile, body, channel, now, history);
}
