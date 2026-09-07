import { runRadar, type RadarResult } from "../domain/pipeline.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import { collectFromSources, type OpportunitySource } from "../domain/source.js";

export interface RadarRun {
  startedAt: string;
  finishedAt: string;
  results: RadarResult[];
}

export async function executeRadar(
  sources: readonly OpportunitySource[],
  profile: CandidateProfile,
): Promise<RadarRun> {
  const startedAt = new Date().toISOString();
  const opportunities = await collectFromSources(sources);
  const results = runRadar(opportunities, profile);
  return { startedAt, finishedAt: new Date().toISOString(), results };
}

export function analyzeExisting(opportunities: readonly Opportunity[], profile: CandidateProfile): RadarResult[] {
  return runRadar([...opportunities], profile);
}
