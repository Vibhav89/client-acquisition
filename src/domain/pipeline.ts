import type { CandidateProfile, Opportunity, OpportunityAnalysis } from "./opportunity.js";
import type { ProposalDraft } from "./proposal.js";
import { analyzeOpportunity } from "./analyze.js";
import { draftProposal } from "./proposal.js";

export interface RadarResult {
  opportunity: Opportunity;
  analysis: OpportunityAnalysis;
  proposal?: ProposalDraft;
}

export function runRadar(opportunities: Opportunity[], profile: CandidateProfile): RadarResult[] {
  return opportunities
    .map((opportunity) => {
      const analysis = analyzeOpportunity(opportunity, profile);
      const proposal = analysis.recommendation === "apply" ? draftProposal(opportunity, profile) : undefined;
      return { opportunity, analysis, ...(proposal ? { proposal } : {}) };
    })
    .sort((a, b) => b.analysis.match.score - a.analysis.match.score);
}
