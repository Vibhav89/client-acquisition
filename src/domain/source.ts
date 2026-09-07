import type { Opportunity } from "./opportunity.js";
import { normalizeOpportunity, type RawOpportunity } from "./normalizer.js";

export interface OpportunitySource {
  readonly name: string;
  fetch(): Promise<RawOpportunity[]>;
}

export async function collectFromSources(sources: readonly OpportunitySource[]): Promise<Opportunity[]> {
  const results = await Promise.allSettled(sources.map((source) => source.fetch()));
  const opportunities: Opportunity[] = [];

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const source = sources[index];
    if (!source) return;
    for (const raw of result.value) {
      try {
        opportunities.push(normalizeOpportunity({ ...raw, source: raw.source || source.name }));
      } catch {
        // A malformed source record must not abort the entire discovery run.
      }
    }
  });

  return deduplicateOpportunities(opportunities);
}

export function deduplicateOpportunities(opportunities: readonly Opportunity[]): Opportunity[] {
  const seen = new Set<string>();
  return opportunities.filter((opportunity) => {
    const key = `${opportunity.source}|${opportunity.sourceUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
