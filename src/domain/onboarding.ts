import type { PersonalAgentProfile } from "./master-profile.js";

export interface OnboardingValidation {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateOnboardingProfile(profile: Partial<PersonalAgentProfile>): OnboardingValidation {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!profile.displayName?.trim()) missing.push("displayName");
  if (!profile.headline?.trim()) missing.push("headline");
  if (!profile.bio?.trim()) missing.push("bio");
  if (!profile.skills?.length) missing.push("skills");
  if (!profile.evidence?.length) missing.push("evidence");
  if (!profile.portfolio?.length) warnings.push("Add at least one portfolio item for stronger proposal evidence.");
  if (!profile.services?.length) warnings.push("Add at least one service offer so pricing and delivery can be suggested.");
  if (!profile.platformAccounts?.some((account) => account.enabled)) warnings.push("Enable at least one platform account before platform radar is started.");

  const negotiation = profile.negotiation;
  if (!negotiation) {
    missing.push("negotiation");
  } else {
    if (negotiation.maxDiscountPercent < 0 || negotiation.maxDiscountPercent > 100) {
      missing.push("negotiation.maxDiscountPercent");
    }
    if (negotiation.requireFinalApproval !== true) {
      warnings.push("Final approval should remain enabled for binding client/deal commitments.");
    }
  }

  return { valid: missing.length === 0, missing, warnings };
}

export function normalizeOnboardingProfile(profile: PersonalAgentProfile, now = new Date().toISOString()): PersonalAgentProfile {
  return {
    ...profile,
    displayName: profile.displayName.trim(),
    headline: profile.headline.trim(),
    bio: profile.bio.trim(),
    skills: [...new Set(profile.skills.map((skill) => skill.trim()).filter(Boolean))],
    evidence: [...profile.evidence],
    countries: profile.countries?.map((country) => country.trim()).filter(Boolean),
    languages: profile.languages?.map((language) => language.trim()).filter(Boolean),
    industries: profile.industries?.map((industry) => industry.trim()).filter(Boolean),
    portfolio: profile.portfolio.map((item) => ({ ...item, title: item.title.trim(), description: item.description.trim(), skills: [...new Set(item.skills.map((skill) => skill.trim()).filter(Boolean))] })),
    services: profile.services.map((service) => ({ ...service, name: service.name.trim(), description: service.description.trim() })),
    platformAccounts: profile.platformAccounts.map((account) => ({ ...account, platform: account.platform.trim(), profileUrl: account.profileUrl?.trim(), username: account.username?.trim() })),
    redFlags: [...new Set(profile.redFlags.map((flag) => flag.trim()).filter(Boolean))],
    lastUpdatedAt: now,
  };
}
