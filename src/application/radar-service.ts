import { collectFromSources, type OpportunitySource as RawOpportunitySource } from "../domain/source.js";
import { runRadar, type RadarResult } from "../domain/radar.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";

/**
 * Discovery source used by the application layer.
 * Adapters expose raw records; this boundary normalizes and deduplicates them.
 */
export type OpportunitySource = RawOpportunitySource;

export interface DiscoveryReport {
  source: string;
  discovered: number;
  failed: boolean;
  error?: string;
}

export interface RadarRunResult extends RadarResult {
  reports: DiscoveryReport[];
}

/**
 * Discover from all configured sources. A source failure is isolated so one
 * unavailable provider cannot prevent the remaining sources from running.
 */
export async function discoverAndAnalyze(
  sources: readonly OpportunitySource[],
  profile: CandidateProfile,
): Promise<RadarRunResult> {
  const reports: DiscoveryReport[] = [];
  const all: Opportunity[] = [];

  for (const source of sources) {
    try {
      const opportunities = await collectFromSources([source]);
      all.push(...opportunities);
      reports.push({ source: source.name, discovered: opportunities.length, failed: false });
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
