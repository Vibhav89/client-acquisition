import type { CandidateProfile, WorkMode } from "./opportunity.js";

export interface PortfolioItem { title: string; url?: string | undefined; description: string; skills: string[]; }
export interface ServiceOffer { name: string; description: string; minimumUsd?: number | undefined; deliveryDays?: number | undefined; }
export interface NegotiationPolicy { minimumHourlyUsd?: number | undefined; minimumFixedUsd?: number | undefined; preferredHourlyUsd?: number | undefined; preferredFixedUsd?: number | undefined; maxDiscountPercent: number; requireScopeConfirmation: boolean; requireFinalApproval: boolean; }
export interface PlatformAccount { platform: string; profileUrl?: string | undefined; username?: string | undefined; enabled: boolean; }

export interface PersonalAgentProfile extends CandidateProfile {
  displayName: string;
  headline: string;
  bio: string;
  location?: string | undefined;
  timezone?: string | undefined;
  countries?: string[] | undefined;
  languages?: string[] | undefined;
  industries?: string[] | undefined;
  availabilityHoursPerWeek?: number | undefined;
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
