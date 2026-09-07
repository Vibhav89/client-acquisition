import { runRadar, type RadarResult } from "../domain/radar.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";

export interface OpportunitySource {
  readonly name: string;
  discover(): Promise<readonly Opportunity[]>;
}

export interface DiscoveryReport {
  source: string;
  discovered: number;
  failed: boolean;
  error?: string;
}

export interface RadarRunResult extends RadarResult {
  reports: DiscoveryReport[];
}

export async function discoverAndAnalyze(
  sources: readonly OpportunitySource[],
  profile: CandidateProfile,
): Promise<RadarRunResult> {
  const all: Opportunity[] = [];
  const reports: DiscoveryReport[] = [];

  for (const source of sources) {
    try {
      const items = await source.discover();
      all.push(...items);
      reports.push({ source: source.name, discovered: items.length, failed: false });
    } catch (error) {
      reports.push({
        source: source.name,
        discovered: 0,
        failed: true,
        error: error instanceof Error ? error.message : "Unknown source error",
      });
    }
  }

  return { ...runRadar(all, profile), reports };
}
