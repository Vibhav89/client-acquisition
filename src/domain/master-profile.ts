import type { CandidateProfile, WorkMode } from "./opportunity.js";

export interface PortfolioItem { title: string; url?: string; description: string; skills: string[]; }
export interface ServiceOffer { name: string; description: string; minimumUsd?: number; deliveryDays?: number; }
export interface NegotiationPolicy { minimumHourlyUsd?: number; minimumFixedUsd?: number; preferredHourlyUsd?: number; preferredFixedUsd?: number; maxDiscountPercent: number; requireScopeConfirmation: boolean; requireFinalApproval: boolean; }
export interface PlatformAccount { platform: string; profileUrl?: string; username?: string; enabled: boolean; }

export interface PersonalAgentProfile extends CandidateProfile {
  displayName: string;
  headline: string;
  bio: string;
  location?: string;
  timezone?: string;
  countries?: string[];
  languages?: string[];
  industries?: string[];
  availabilityHoursPerWeek?: number;
  portfolio: PortfolioItem[];
  services: ServiceOffer[];
  platformAccounts: PlatformAccount[];
  communicationStyle: "concise" | "professional" | "friendly" | "technical";
  negotiation: NegotiationPolicy;
  redFlags: string[];
  lastUpdatedAt: string;
}

export function toCandidateProfile(profile: PersonalAgentProfile): CandidateProfile {
  return {
    skills: profile.skills,
    evidence: profile.evidence,
    preferredWorkModes: profile.preferredWorkModes,
    minimumHourlyUsd: profile.negotiation.minimumHourlyUsd,
    minimumFixedUsd: profile.negotiation.minimumFixedUsd,
  };
}
