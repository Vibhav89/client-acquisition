import { buildDashboardModel, type DashboardModel } from "./dashboard.js";
import { discoverAndAnalyze, type OpportunitySource } from "./radar-service.js";
import type { ApprovalRequest } from "../domain/approval.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { PersistencePort } from "../domain/persistence.js";
import { DefaultApprovalService } from "./approval-service.js";

export interface ClientRadarRun {
  dashboard: DashboardModel;
  approvals: ApprovalRequest[];
  opportunities: Opportunity[];
  reports: Awaited<ReturnType<typeof discoverAndAnalyze>>["reports"];
}

export async function runClientRadar(
  sources: readonly OpportunitySource[], profile: CandidateProfile | PersonalAgentProfile, persistence: PersistencePort,
  now = new Date().toISOString(),
): Promise<ClientRadarRun> {
  const result = await discoverAndAnalyze(sources, profile);
  for (const ranked of result.ranked) await persistence.saveOpportunity(ranked.opportunity);
  const approvalService = new DefaultApprovalService(persistence);
  const approvals = await approvalService.createForRadar(result, profile, now);
  return {
    dashboard: buildDashboardModel(result), approvals,
    opportunities: result.ranked.map((ranked) => ranked.opportunity), reports: result.reports,
  };
}
