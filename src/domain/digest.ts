import type { RankedOpportunity } from "./rank.js";
import type { ClientRecord } from "./client.js";
import type { ApprovalRequest } from "./approval.js";
import type { ApplicationRecord } from "./application-tracking.js";
import type { EarningsRecord } from "./earnings.js";
import type { LearningEvent } from "./learning.js";
import { planFollowUp } from "./follow-up.js";

export interface DailyAcquisitionDigest {
  generatedAt: string;
  summary: {
    topOpportunitiesCount: number;
    activeClientsCount: number;
    highRiskRejectionsCount: number;
    approvalsWaitingCount: number;
    dueFollowUpsCount: number;
    totalEarningsUsd: number;
  };
  topOpportunities: Array<{
    rank: number;
    id: string;
    title: string;
    source: string;
    sourceUrl: string;
    matchScore: number;
    riskLevel: string;
    recommendation: string;
    whyMatch: string;
  }>;
  topClients: Array<{
    id: string;
    summary: string;
    stage: string;
    fitScore: number;
  }>;
  highRiskRejections: Array<{
    id: string;
    title: string;
    source: string;
    signals: string[];
  }>;
  approvalsWaiting: Array<{
    id: string;
    opportunityId: string;
    state: string;
  }>;
  clientReplies: Array<{
    clientId: string;
    summary: string;
  }>;
  negotiations: Array<{
    clientId: string;
    summary: string;
  }>;
  followUps: Array<{
    clientId: string;
    summary: string;
  }>;
  applications: Array<{
    id: string;
    status: string;
  }>;
  earningsSummary: {
    totalUsd: number;
    paymentsCount: number;
  };
  learningInsights: {
    totalEvents: number;
    winRatePercent: number;
    topPerformingSource?: string;
  };
}

export function generateDailyDigest(input: {
  opportunities: readonly RankedOpportunity[];
  clients?: readonly ClientRecord[];
  approvals?: readonly ApprovalRequest[];
  applications?: readonly ApplicationRecord[];
  earnings?: readonly EarningsRecord[];
  learningEvents?: readonly LearningEvent[];
  limit?: number;
  now?: string;
}): DailyAcquisitionDigest {
  const now = input.now ?? new Date().toISOString();
  const limit = input.limit ?? 10;
  const clients = input.clients ?? [];
  const approvals = input.approvals ?? [];
  const applications = input.applications ?? [];
  const earnings = input.earnings ?? [];
  const learningEvents = input.learningEvents ?? [];

  // Filter high-risk rejections
  const highRisk = input.opportunities.filter((o) => o.analysis.risk.level === "high");

  // Qualified opportunities sorted by rank score
  const qualified = input.opportunities
    .filter((o) => o.analysis.risk.level !== "high" && o.analysis.recommendation !== "skip")
    .sort((a, b) => b.rankScore - a.rankScore);

  const topOpps = qualified.slice(0, limit).map((o, idx) => ({
    rank: idx + 1,
    id: o.opportunity.id,
    title: o.opportunity.title,
    source: o.opportunity.source,
    sourceUrl: o.opportunity.sourceUrl,
    matchScore: o.analysis.match.score,
    riskLevel: o.analysis.risk.level,
    recommendation: o.analysis.recommendation,
    whyMatch: o.analysis.match.fitReasons.join("; ") || "Matched core candidate skills",
  }));

  const activeClients = clients.filter((c) => !["lost", "review"].includes(c.stage));

  const dueFollowUps = clients.filter((c) => planFollowUp(c, now).shouldFollowUp);

  const pendingApprovals = approvals.filter((a) => a.state === "pending");

  const totalEarningsUsd = earnings.reduce((sum, e) => sum + e.amount, 0);

  const wins = learningEvents.filter((e) => e.outcome === "won").length;
  const winRatePercent = learningEvents.length > 0 ? Number(((wins / learningEvents.length) * 100).toFixed(1)) : 0;

  return {
    generatedAt: now,
    summary: {
      topOpportunitiesCount: topOpps.length,
      activeClientsCount: activeClients.length,
      highRiskRejectionsCount: highRisk.length,
      approvalsWaitingCount: pendingApprovals.length,
      dueFollowUpsCount: dueFollowUps.length,
      totalEarningsUsd,
    },
    topOpportunities: topOpps,
    topClients: activeClients.slice(0, 5).map((c) => ({
      id: c.id,
      summary: c.summary,
      stage: c.stage,
      fitScore: c.fitScore,
    })),
    highRiskRejections: highRisk.map((o) => ({
      id: o.opportunity.id,
      title: o.opportunity.title,
      source: o.opportunity.source,
      signals: o.analysis.risk.signals,
    })),
    approvalsWaiting: pendingApprovals.map((a) => ({
      id: a.id,
      opportunityId: a.opportunityId,
      state: a.state,
    })),
    clientReplies: clients.filter((c) => c.stage === "conversation").map((c) => ({ clientId: c.id, summary: c.summary })),
    negotiations: clients.filter((c) => c.stage === "negotiation").map((c) => ({ clientId: c.id, summary: c.summary })),
    followUps: dueFollowUps.map((c) => ({ clientId: c.id, summary: c.summary })),
    applications: applications.map((a) => ({ id: a.id, status: a.status })),
    earningsSummary: {
      totalUsd: totalEarningsUsd,
      paymentsCount: earnings.length,
    },
    learningInsights: {
      totalEvents: learningEvents.length,
      winRatePercent,
    },
  };
}
