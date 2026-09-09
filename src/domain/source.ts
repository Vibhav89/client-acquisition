import type { Opportunity } from "./opportunity.js";
import { normalizeOpportunity, type RawOpportunity } from "./normalizer.js";
import { deduplicateOpportunities } from "./dedup.js";

export { deduplicateOpportunities } from "./dedup.js";

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
