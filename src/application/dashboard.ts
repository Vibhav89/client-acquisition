import type { RadarResult } from "../domain/pipeline.js";

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

function budgetLabel(result: RadarResult): string {
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

export function buildDashboardModel(results: readonly RadarResult[]): DashboardModel {
  const opportunities = [...results]
    .sort((a, b) => b.analysis.match.score - a.analysis.match.score)
    .map((result) => ({
      id: result.opportunity.id,
      title: result.opportunity.title,
      source: result.opportunity.source,
      sourceUrl: result.opportunity.sourceUrl,
      matchScore: result.analysis.match.score,
      riskLevel: result.analysis.risk.level,
      recommendation: result.analysis.recommendation,
      budgetLabel: budgetLabel(result),
      matchedSkills: [...result.analysis.match.matchedSkills],
    }));

  return {
    summary: {
      discovered: opportunities.length,
      qualified: results.filter((r) => r.analysis.recommendation === "apply").length,
      review: results.filter((r) => r.analysis.recommendation === "review").length,
      skipped: results.filter((r) => r.analysis.recommendation === "skip").length,
      lowRisk: results.filter((r) => r.analysis.risk.level === "low").length,
      pendingProposalReview: results.filter(
        (r) => r.analysis.recommendation === "apply" && r.proposal !== undefined,
      ).length,
    },
    opportunities,
  };
}
