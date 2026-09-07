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

export function runRadar(
  opportunities: readonly Opportunity[],
  profile: CandidateProfile,
): RadarResult {
  const unique = new Map<string, Opportunity>();
  for (const opportunity of opportunities) unique.set(opportunity.id, opportunity);

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
