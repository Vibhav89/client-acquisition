import { describe, expect, it } from "vitest";
import { normalizeOnboardingProfile, validateOnboardingProfile } from "../src/domain/onboarding.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

const profile = {
  displayName: "  Vibhav  ", headline: " AI developer ", bio: "  Builds useful tools.  ",
  skills: ["React", "React", " TypeScript "], evidence: ["portfolio"], preferredWorkModes: ["remote"],
  portfolio: [{ title: " Demo ", description: " Project ", skills: ["React", "React"] }],
  services: [{ name: " AI integration ", description: " APIs ", minimumUsd: 25, deliveryDays: 5 }],
  platformAccounts: [{ platform: " Upwork ", username: " user ", enabled: true }],
  communicationStyle: "professional", negotiation: { maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true },
  redFlags: [" crypto ", "crypto"], lastUpdatedAt: "2026-01-01T00:00:00.000Z",
} as PersonalAgentProfile;

describe("master profile onboarding", () => {
  it("rejects incomplete profiles", () => {
    const result = validateOnboardingProfile({ displayName: "V", negotiation: { maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true } } as PersonalAgentProfile);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["headline", "bio", "skills", "evidence"]));
  });

  it("normalizes profile data without changing the contract", () => {
    const normalized = normalizeOnboardingProfile(profile, "2026-09-08T12:00:00.000Z");
    expect(normalized.displayName).toBe("Vibhav");
    expect(normalized.skills).toEqual(["React", "TypeScript"]);
    expect(normalized.portfolio[0].skills).toEqual(["React"]);
    expect(normalized.redFlags).toEqual(["crypto"]);
    expect(normalized.lastUpdatedAt).toBe("2026-09-08T12:00:00.000Z");
  });
});
