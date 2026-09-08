import type { CandidateProfile, Opportunity } from "./opportunity.js";
import type { ClientIntelligence } from "./client.js";
import type { RiskResult } from "./risk.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function suggestedPrice(opportunity: Opportunity, profile: CandidateProfile): number | undefined {
  if (opportunity.budget?.currency?.toUpperCase() !== "USD") return undefined;
  if (opportunity.budget.unit === "hour") {
    const max = opportunity.budget.max;
    if (typeof max === "number" && max > 0) return Math.max(profile.minimumHourlyUsd ?? 0, Math.round(max * 0.9));
    return profile.minimumHourlyUsd;
  }
  if (opportunity.budget.unit === "fixed") {
    const max = opportunity.budget.max;
    if (typeof max === "number" && max > 0) return Math.max(profile.minimumFixedUsd ?? 0, Math.round(max * 0.9));
    return profile.minimumFixedUsd;
  }
  return undefined;
}

export function analyzeClient(opportunity: Opportunity, profile: CandidateProfile, risk: RiskResult): ClientIntelligence {
  const matched = opportunity.skills.filter((skill) => profile.skills.some((mine) => mine.toLowerCase() === skill.toLowerCase()));
  const fitScore = clamp((matched.length / Math.max(opportunity.skills.length, 1)) * 70 + Math.min(30, matched.length * 5));
  const legitimacyScore = clamp(100 - risk.score);
  const priorityScore = clamp(fitScore * 0.55 + legitimacyScore * 0.35 + (opportunity.client?.verified ? 10 : 0));
  const needs = [opportunity.title, ...matched.map((skill) => `delivery using ${skill}`)].slice(0, 5);
  const objections: string[] = [];
  if (matched.length < opportunity.skills.length) objections.push("Some requested skills are not evidenced in the current profile.");
  if (!opportunity.budget) objections.push("Budget is not visible; pricing needs confirmation.");
  if (risk.signals.length) objections.push(...risk.signals.slice(0, 2));
  const approachAngle = matched.length > 0
    ? `Lead with proven work around ${matched.slice(0, 3).join(", ")} and propose a small first milestone.`
    : "Ask targeted scope questions before committing to a solution.";
  const suggestedDeliveryDays = opportunity.budget?.unit === "fixed" ? 3 : undefined;
  return {
    fitScore,
    legitimacyScore,
    priorityScore,
    needs,
    objections: [...new Set(objections)],
    approachAngle,
    suggestedPriceUsd: suggestedPrice(opportunity, profile),
    suggestedDeliveryDays,
    nextAction: priorityScore >= 75 ? "Prepare a personalized approach for user approval." : "Keep in qualification; gather more client evidence.",
    reasoning: [
      `Matched skills: ${matched.length}/${opportunity.skills.length || 0}.`,
      `Risk signals: ${risk.signals.length}.`,
      opportunity.client?.verified ? "Client verification signal is present." : "No client verification signal was captured.",
    ],
  };
}
