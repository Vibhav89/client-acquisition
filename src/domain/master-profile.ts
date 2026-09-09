import type { CandidateProfile, WorkMode } from "./opportunity.js";

export interface SkillDetail {
  skill: string;
  evidence: string;
  strength: number;
  proficiency?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
  category?: "frontend" | "backend" | "ai" | "database" | "devops" | "other" | undefined;
}

export interface WorkExperience {
  company: string;
  role: string;
  description: string;
  achievements?: string[] | undefined;
  technologies?: string[] | undefined;
  duration?: string | undefined;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field?: string | undefined;
  dates?: string | undefined;
}

export interface PortfolioItem {
  title: string;
  description: string;
  skills: string[];
  role?: string | undefined;
  results?: string | undefined;
  url?: string | undefined;
  githubUrl?: string | undefined;
  demoUrl?: string | undefined;
}

export interface ServiceOffer {
  name: string;
  description: string;
  minimumUsd?: number | undefined;
  preferredUsd?: number | undefined;
  deliveryDays?: number | undefined;
}

export interface NegotiationPolicy {
  minimumHourlyUsd?: number | undefined;
  minimumFixedUsd?: number | undefined;
  preferredHourlyUsd?: number | undefined;
  preferredFixedUsd?: number | undefined;
  maxDiscountPercent: number;
  requireScopeConfirmation: boolean;
  requireFinalApproval: boolean;
}

export interface PlatformAccount {
  platform: string;
  profileUrl?: string | undefined;
  username?: string | undefined;
  enabled: boolean;
}

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
  experience?: WorkExperience[] | undefined;
  education?: EducationItem[] | undefined;
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
