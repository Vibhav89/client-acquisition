import type { RadarResult } from "../domain/radar.js";

export interface DashboardOpportunity {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  matchScore: number;
  riskLevel: string;
  recommendation: string;
  budgetLabel: string;
  matchedSkills: string[];
}

export interface DashboardSummary {
  discovered: number;
  qualified: number;
  review: number;
  skipped: number;
  lowRisk: number;
  pendingProposalReview: number;
}

export interface DashboardModel {
  summary: DashboardSummary;
  opportunities: DashboardOpportunity[];
}

function budgetLabel(result: RadarResult["ranked"][number]): string {
  const budget = result.opportunity.budget;
  if (!budget) return "Budget not specified";
  const currency = budget.currency.toUpperCase();
  if (budget.min !== undefined && budget.max !== undefined) {
    return `${currency} ${budget.min}-${budget.max}/${budget.unit}`;
  }
  if (budget.max !== undefined) return `Up to ${currency} ${budget.max}/${budget.unit}`;
  if (budget.min !== undefined) return `From ${currency} ${budget.min}/${budget.unit}`;
  return `${currency} (${budget.unit})`;
}

export function buildDashboardModel(result: RadarResult): DashboardModel {
  const opportunities = [...result.ranked]
    .sort((a, b) => b.analysis.match.score - a.analysis.match.score)
    .map((ranked) => ({
      id: ranked.opportunity.id,
      title: ranked.opportunity.title,
      source: ranked.opportunity.source,
      sourceUrl: ranked.opportunity.sourceUrl,
      matchScore: ranked.analysis.match.score,
      riskLevel: ranked.analysis.risk.level,
      recommendation: ranked.analysis.recommendation,
      budgetLabel: budgetLabel(ranked),
      matchedSkills: [...ranked.analysis.match.matchedSkills],
    }));

  return {
    summary: {
      discovered: result.discovered,
      qualified: result.ranked.filter((r) => r.analysis.recommendation === "apply").length,
      review: result.ranked.filter((r) => r.analysis.recommendation === "review").length,
      skipped: result.ranked.filter((r) => r.analysis.recommendation === "skip").length,
      lowRisk: result.ranked.filter((r) => r.analysis.risk.level === "low").length,
      pendingProposalReview: result.ranked.filter((r) => r.analysis.recommendation === "apply").length,
    },
    opportunities,
  };
}
