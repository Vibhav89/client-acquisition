import type { Opportunity, OpportunityAnalysis } from "./opportunity.js";

export interface RankedOpportunity {
  opportunity: Opportunity;
  analysis: OpportunityAnalysis;
  rankScore: number;
}

export function rankOpportunities(
  items: readonly { opportunity: Opportunity; analysis: OpportunityAnalysis }[],
): RankedOpportunity[] {
  return items
    .map(({ opportunity, analysis }) => ({
      opportunity,
      analysis,
      rankScore: Math.round(
        analysis.match.score * 0.65 +
        (100 - analysis.risk.score) * 0.25 +
        (opportunity.workMode === "remote" ? 10 : 0),
      ),
    }))
    .sort((a, b) => b.rankScore - a.rankScore);
}
