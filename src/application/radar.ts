import { runRadar, type RadarResult } from "../domain/radar.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import { collectFromSources, type OpportunitySource } from "../domain/source.js";

export interface RadarRun {
  startedAt: string;
  finishedAt: string;
  result: RadarResult;
}

export async function executeRadar(
  sources: readonly OpportunitySource[],
  profile: CandidateProfile,
): Promise<RadarRun> {
  const startedAt = new Date().toISOString();
  const opportunities = await collectFromSources(sources);
  const result = runRadar(opportunities, profile);
  return { startedAt, finishedAt: new Date().toISOString(), result };
}

export function analyzeExisting(
  opportunities: readonly Opportunity[],
  profile: CandidateProfile,
): RadarResult {
  return runRadar([...opportunities], profile);
}
