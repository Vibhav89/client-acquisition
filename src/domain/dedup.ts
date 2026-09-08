import type { Opportunity } from "./opportunity.js";

function text(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalOpportunityKey(opportunity: Opportunity): string {
  const source = text(opportunity.source);
  try {
    const url = new URL(opportunity.sourceUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|campaign$|tracking)/i.test(key)) url.searchParams.delete(key);
    }
    return `source:${source}|url:${url.toString().replace(/\/$/, "")}`;
  } catch {
    const company = text(opportunity.client?.name);
    return `source:${source}|text:${text(opportunity.title)}|${company}`;
  }
}

export function deduplicateOpportunities(opportunities: readonly Opportunity[]): Opportunity[] {
  const unique = new Map<string, Opportunity>();
  for (const opportunity of opportunities) unique.set(canonicalOpportunityKey(opportunity), opportunity);
  return [...unique.values()];
}
