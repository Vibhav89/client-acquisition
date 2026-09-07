import { runRadar, type RadarResult } from "../domain/radar.js";
import { normalizeOpportunity, type RawOpportunity } from "../domain/normalizer.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";

/**
 * Application-level source contract. New integrations should expose fetch();
 * discover() is retained for already-normalized test/adaptor callers.
 */
export interface OpportunitySource {
  readonly name: string;
  readonly fetch?: () => Promise<RawOpportunity[]>;
  readonly discover?: () => Promise<readonly Opportunity[]>;
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

async function discoverSource(source: OpportunitySource): Promise<Opportunity[]> {
  if (source.fetch) {
    const raw = await source.fetch();
    const normalized: Opportunity[] = [];
    for (const item of raw) {
      try {
        normalized.push(normalizeOpportunity({ ...item, source: item.source || source.name }));
      } catch {
        // Ignore malformed records; the source remains usable.
      }
    }
    return normalized;
  }
  if (source.discover) return [...await source.discover()];
  throw new Error(`Source ${source.name} has no fetch or discover implementation`);
}

export async function discoverAndAnalyze(
  sources: readonly OpportunitySource[],
  profile: CandidateProfile,
): Promise<RadarRunResult> {
  const all: Opportunity[] = [];
  const reports: DiscoveryReport[] = [];

  for (const source of sources) {
    try {
      const opportunities = await discoverSource(source);
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
