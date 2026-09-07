import { analyzeOpportunity } from "./analyze.js";
import type { CandidateProfile, Opportunity, OpportunityAnalysis } from "./opportunity.js";
import { rankOpportunities, type RankedOpportunity } from "./rank.js";

export interface RadarResult {
  discovered: number;
  analyzed: number;
  qualified: number;
  skipped: number;
  ranked: RankedOpportunity[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function canonicalKey(opportunity: Opportunity): string {
  try {
    const url = new URL(opportunity.sourceUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|campaign$|tracking)/i.test(key)) url.searchParams.delete(key);
    }
    return `${normalizeText(opportunity.source)}|url:${url.toString().replace(/\/$/, "")}`;
  } catch {
    const company = normalizeText(opportunity.client?.name ?? "");
    return `${normalizeText(opportunity.source)}|job:${normalizeText(opportunity.title)}|company:${company}`;
  }
}

export function runRadar(
  opportunities: readonly Opportunity[],
  profile: CandidateProfile,
): RadarResult {
  const unique = new Map<string, Opportunity>();
  for (const opportunity of opportunities) unique.set(canonicalKey(opportunity), opportunity);

  const analyzed: { opportunity: Opportunity; analysis: OpportunityAnalysis }[] = [];
  for (const opportunity of unique.values()) {
    analyzed.push({ opportunity, analysis: analyzeOpportunity(opportunity, profile) });
  }

  const ranked = rankOpportunities(analyzed);
  return {
    discovered: opportunities.length,
    analyzed: analyzed.length,
    qualified: analyzed.filter((item) => item.analysis.recommendation !== "skip").length,
    skipped: analyzed.filter((item) => item.analysis.recommendation === "skip").length,
    ranked,
  };
}
