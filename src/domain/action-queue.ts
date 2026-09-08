import type { ClientRecord, ClientStage } from "./client.js";
import type { Opportunity, OpportunityAnalysis } from "./opportunity.js";
import type { RankedOpportunity } from "./rank.js";

export type ActionType = "approval" | "reply" | "follow_up" | "review_opportunity" | "apply" | "deal_review";

export interface ActionItem {
  id: string;
  type: ActionType;
  title: string;
  summary: string;
  priority: number;
  clientId?: string;
  opportunityId?: string;
  source?: string;
  sourceUrl?: string;
  requiresUserApproval: boolean;
  createdAt: string;
}

const stagePriority: Partial<Record<ClientStage, number>> = {
  final_approval: 100,
  interested: 90,
  negotiation: 85,
  conversation: 80,
  replied: 75,
  approached: 55,
};

export function buildActionQueue(
  clients: readonly ClientRecord[],
  opportunities: readonly RankedOpportunity[],
  approvals: readonly { id: string; opportunityId: string; state: string; createdAt: string }[] = [],
  now = new Date().toISOString(),
): ActionItem[] {
  const items: ActionItem[] = [];
  const pendingApprovalIds = new Set(approvals.filter((a) => a.state === "pending").map((a) => a.opportunityId));

  for (const approval of approvals) {
    if (approval.state !== "pending") continue;
    const opportunity = opportunities.find((item) => item.opportunity.id === approval.opportunityId)?.opportunity;
    items.push({
      id: `approval:${approval.id}`,
      type: "approval",
      title: "Approval required",
      summary: opportunity?.title ?? "Review pending application approval",
      priority: 110,
      opportunityId: approval.opportunityId,
      source: opportunity?.source,
      sourceUrl: opportunity?.sourceUrl,
      requiresUserApproval: true,
      createdAt: approval.createdAt,
    });
  }

  for (const client of clients) {
    const base = stagePriority[client.stage];
    if (base === undefined) continue;
    items.push({
      id: `client:${client.id}:${client.stage}`,
      type: client.stage === "final_approval" ? "deal_review" : client.stage === "replied" || client.stage === "conversation" ? "reply" : "follow_up",
      title: client.nextAction,
      summary: client.summary,
      priority: Math.min(109, base + Math.round(client.priorityScore * 0.25)),
      clientId: client.id,
      source: client.source,
      sourceUrl: client.sourceUrl,
      requiresUserApproval: client.stage === "final_approval" || client.stage === "replied" || client.stage === "conversation",
      createdAt: client.updatedAt,
    });
  }

  for (const ranked of opportunities) {
    if (pendingApprovalIds.has(ranked.opportunity.id)) continue;
    if (ranked.analysis.recommendation === "apply") {
      items.push({
        id: `opportunity:${ranked.opportunity.id}:apply`,
        type: "apply",
        title: "Strong opportunity",
        summary: ranked.opportunity.title,
        priority: Math.min(79, Math.round(ranked.rankScore)),
        opportunityId: ranked.opportunity.id,
        source: ranked.opportunity.source,
        sourceUrl: ranked.opportunity.sourceUrl,
        requiresUserApproval: true,
        createdAt: ranked.opportunity.discoveredAt,
      });
    } else if (ranked.analysis.recommendation === "review") {
      items.push({
        id: `opportunity:${ranked.opportunity.id}:review`,
        type: "review_opportunity",
        title: "Opportunity review",
        summary: ranked.opportunity.title,
        priority: Math.min(59, Math.round(ranked.rankScore)),
        opportunityId: ranked.opportunity.id,
        source: ranked.opportunity.source,
        sourceUrl: ranked.opportunity.sourceUrl,
        requiresUserApproval: false,
        createdAt: ranked.opportunity.discoveredAt,
      });
    }
  }

  return items
    .filter((item) => Date.parse(item.createdAt) <= Date.parse(now))
    .sort((a, b) => b.priority - a.priority || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
