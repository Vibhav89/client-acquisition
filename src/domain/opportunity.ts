export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export type OpportunityStatus = "new" | "qualified" | "skipped" | "approved" | "applied";
export type RiskLevel = "low" | "medium" | "high";

export interface Opportunity {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  description: string;
  skills: string[];
  workMode: WorkMode;
  location?: string;
  budget?: {
    currency: string;
    min?: number;
    max?: number;
    unit: "hour" | "fixed" | "unknown";
  };
  client?: {
    name?: string;
    country?: string;
    verified?: boolean;
    hireRate?: number;
    totalSpent?: number;
  };
  status: OpportunityStatus;
  discoveredAt: string;
}

export interface CandidateProfile {
  skills: string[];
  evidence: Array<{ skill: string; evidence: string; strength: number }>;
  preferredWorkModes: WorkMode[];
  minimumHourlyUsd?: number;
}

export interface MatchResult {
  opportunityId: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  evidenceScore: number;
  budgetScore: number;
  fitReasons: string[];
}

export interface RiskResult {
  level: RiskLevel;
  score: number;
  signals: string[];
}

export interface OpportunityAnalysis {
  match: MatchResult;
  risk: RiskResult;
  recommendation: "apply" | "review" | "skip";
}
