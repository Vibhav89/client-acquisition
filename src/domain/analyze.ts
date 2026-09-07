import type { CandidateProfile, Opportunity, OpportunityAnalysis } from "./opportunity.js";
import { scoreOpportunity } from "./match.js";
import { assessRisk } from "./risk.js";

export function analyzeOpportunity(
  opportunity: Opportunity,
  profile: CandidateProfile,
): OpportunityAnalysis {
  const match = scoreOpportunity(opportunity, profile);
  const risk = assessRisk(opportunity);

  const recommendation = risk.level === "high"
    ? "skip"
    : match.score >= 75
      ? "apply"
      : match.score >= 50
        ? "review"
        : "skip";

  return { match, risk, recommendation };
}
