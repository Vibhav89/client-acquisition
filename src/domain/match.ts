import type { CandidateProfile, MatchResult, Opportunity } from "./opportunity.js";

const normalize = (value: string): string => value.trim().toLowerCase();

export function scoreOpportunity(opportunity: Opportunity, profile: CandidateProfile): MatchResult {
  const wanted = new Set(profile.skills.map(normalize));
  const available = [...new Set(opportunity.skills.map(normalize))];
  const matchedSkills = available.filter((skill) => wanted.has(skill));
  const missingSkills = available.filter((skill) => !wanted.has(skill));

  // Score against the skills requested by this job, not against every skill in the CV.
  // This prevents broad profiles from being unfairly penalized for unrelated skills.
  const skillScore = available.length === 0 ? 0 : (matchedSkills.length / available.length) * 60;
  const evidenceScore = matchedSkills.length === 0 || profile.evidence.length === 0
    ? 0
    : (profile.evidence
      .filter((item) => matchedSkills.includes(normalize(item.skill)))
      .reduce((sum, item) => sum + Math.max(0, Math.min(1, item.strength)), 0) / matchedSkills.length) * 20;

  let budgetScore = 0;
  if (opportunity.budget?.currency && opportunity.budget.currency.toUpperCase() === "USD") {
    const topOfRange = opportunity.budget.max ?? opportunity.budget.min ?? 0;
    const threshold = opportunity.budget.unit === "fixed"
      ? (profile.minimumFixedUsd ?? 0)
      : (profile.minimumHourlyUsd ?? 0);
    budgetScore = topOfRange >= threshold ? 20 : 5;
  }

  const score = Math.round(Math.min(100, skillScore + evidenceScore + budgetScore));
  const fitReasons: string[] = [];
  if (matchedSkills.length > 0) fitReasons.push(`Matches ${matchedSkills.length} requested skill(s).`);
  if (missingSkills.length > 0) fitReasons.push(`Missing ${missingSkills.length} requested skill(s).`);
  if (budgetScore >= 20) fitReasons.push("Budget meets the configured USD threshold.");
  if (opportunity.budget?.unit === "fixed" && budgetScore >= 20) fitReasons.push("Fixed-price work meets the configured starter threshold.");
  if (opportunity.workMode === "remote") fitReasons.push("Remote work matches the target delivery model.");

  return { opportunityId: opportunity.id, score, matchedSkills, missingSkills, evidenceScore: Math.round(evidenceScore), budgetScore, fitReasons };
}
