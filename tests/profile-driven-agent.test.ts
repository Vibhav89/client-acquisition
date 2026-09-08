import { describe, expect, it } from "vitest";
import { InMemoryProfilePersistence } from "../src/domain/profile-persistence.js";
import { draftProposalFromMasterProfile, runRadarWithMasterProfile } from "../src/application/profile-driven-agent.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";
import type { OpportunitySource } from "../src/application/radar-service.js";

const profile: PersonalAgentProfile = {
  displayName: "Profile Owner",
  headline: "Senior TypeScript engineer",
  bio: "Builds production TypeScript systems.",
  skills: ["TypeScript", "React"],
  evidence: [{ skill: "TypeScript", evidence: "Built production TypeScript applications", strength: 1 }],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 10,
  minimumFixedUsd: 50,
  portfolio: [],
  services: [{ name: "TypeScript development", description: "TypeScript API and application development", minimumUsd: 100 }],
  platformAccounts: [{ platform: "custom", enabled: true }],
  communicationStyle: "professional",
  negotiation: {
    minimumHourlyUsd: 20,
    minimumFixedUsd: 100,
    preferredHourlyUsd: 40,
    preferredFixedUsd: 250,
    maxDiscountPercent: 10,
    requireScopeConfirmation: true,
    requireFinalApproval: true,
  },
  redFlags: [],
  lastUpdatedAt: "2026-09-08T00:00:00.000Z",
};

const source: OpportunitySource = {
  name: "test-source",
  fetch: async () => [{
    id: "profile-job",
    source: "test-source",
    sourceUrl: "https://example.com/job/profile-job",
    url: "https://example.com/job/profile-job",
    title: "TypeScript API work",
    description: "Build a TypeScript API",
    skills: ["TypeScript"],
    workMode: "remote",
    budget: { currency: "USD", unit: "hour", min: 30, max: 60 },
  }],
};

describe("profile-driven agent", () => {
  it("loads the persisted master profile for radar matching", async () => {
    const store = new InMemoryProfilePersistence();
    await store.saveProfile(profile);
    const result = await runRadarWithMasterProfile([source], store);
    expect(result.profile.displayName).toBe("Profile Owner");
    expect(result.ranked[0]?.analysis.match.score).toBeGreaterThan(0);
  });

  it("uses the persisted display name and service in proposals", async () => {
    const store = new InMemoryProfilePersistence();
    await store.saveProfile(profile);
    const proposal = await draftProposalFromMasterProfile({
      id: "proposal-job",
      source: "test-source",
      sourceUrl: "https://example.com/job/proposal-job",
      title: "TypeScript API work",
      description: "Build a TypeScript API",
      skills: ["TypeScript"],
      workMode: "remote",
      status: "new",
      discoveredAt: new Date().toISOString(),
    }, store);
    expect(proposal.body).toContain("Profile Owner");
    expect(proposal.personalization).toContain("Relevant service: TypeScript development");
  });
});
