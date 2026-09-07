import type { Opportunity } from "../domain/opportunity.js";
import { normalizeOpportunity, type RawOpportunity } from "../domain/normalizer.js";

export interface RawSource {
  readonly name: string;
  fetch(): Promise<RawOpportunity[]>;
}

export function adaptRawSource(source: RawSource): { readonly name: string; discover(): Promise<readonly Opportunity[]> } {
  return {
    name: source.name,
    async discover(): Promise<readonly Opportunity[]> {
      const raw = await source.fetch();
      const normalized: Opportunity[] = [];
      for (const item of raw) {
        try {
          normalized.push(normalizeOpportunity({ ...item, source: item.source || source.name }));
        } catch {
          // Ignore malformed records so one bad job cannot abort a feed.
        }
      }
      return normalized;
    },
  };
}
