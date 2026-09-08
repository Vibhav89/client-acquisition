import type { ClientStage, ClientRecord } from "./client.js";

export type Outcome = "won" | "lost" | "rejected" | "ignored";

export interface LearningEvent {
  id: string;
  clientId?: string;
  opportunityId?: string;
  source?: string;
  outcome: Outcome;
  stage?: ClientStage;
  reason?: string;
  matchScore?: number;
  riskScore?: number;
  createdAt: string;
}

export interface LearnedSignal {
  source?: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  averageMatchScore?: number;
  averageRiskScore?: number;
}

export interface LearningPort {
  save(event: LearningEvent): void | Promise<void>;
  list(): LearningEvent[] | Promise<LearningEvent[]>;
}

export class InMemoryLearningStore implements LearningPort {
  private readonly events: LearningEvent[] = [];
  save(event: LearningEvent): void { this.events.push(event); }
  list(): LearningEvent[] { return [...this.events]; }
}

export function summarizeLearning(events: LearningEvent[], source?: string): LearnedSignal {
  const filtered = source ? events.filter((event) => event.source === source) : events;
  const wins = filtered.filter((event) => event.outcome === "won").length;
  const losses = filtered.filter((event) => event.outcome === "lost" || event.outcome === "rejected").length;
  const matches = filtered.flatMap((event) => typeof event.matchScore === "number" ? [event.matchScore] : []);
  const risks = filtered.flatMap((event) => typeof event.riskScore === "number" ? [event.riskScore] : []);
  return {
    ...(source ? { source } : {}),
    total: filtered.length,
    wins,
    losses,
    winRate: filtered.length ? wins / filtered.length : 0,
    ...(matches.length ? { averageMatchScore: matches.reduce((a, b) => a + b, 0) / matches.length } : {}),
    ...(risks.length ? { averageRiskScore: risks.reduce((a, b) => a + b, 0) / risks.length } : {}),
  };
}

export function applyLearningBoost(baseScore: number, source: string, events: LearningEvent[]): number {
  const signal = summarizeLearning(events, source);
  if (signal.total < 5) return Math.max(0, Math.min(100, baseScore));
  const outcomeAdjustment = (signal.winRate - 0.5) * 20;
  return Math.max(0, Math.min(100, Math.round(baseScore + outcomeAdjustment)));
}

export function eventFromClientOutcome(client: ClientRecord, outcome: Extract<Outcome, "won" | "lost">, reason: string, opportunityId?: string, now = new Date().toISOString()): LearningEvent {
  return {
    id: `learning:${client.id}:${now}`,
    clientId: client.id,
    ...(opportunityId ? { opportunityId } : {}),
    source: client.source,
    outcome,
    stage: client.stage,
    reason,
    matchScore: client.fitScore,
    riskScore: 100 - client.legitimacyScore,
    createdAt: now,
  };
}
