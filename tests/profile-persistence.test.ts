import { describe, expect, it } from "vitest";
import { InMemoryProfilePersistence } from "../src/domain/profile-persistence.js";
import { saveMasterProfile, loadMasterProfile } from "../src/application/profile-service.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

const profile = {
  displayName: "Vibhav", headline: "AI developer", bio: "Builds tools", skills: ["React"], evidence: ["portfolio"], preferredWorkModes: ["remote"],
  portfolio: [{ title: "Demo", description: "Project", skills: ["React"] }], services: [{ name: "AI integration", description: "APIs", minimumUsd: 25, deliveryDays: 5 }],
  platformAccounts: [{ platform: "Upwork", enabled: true }], communicationStyle: "professional", negotiation: { maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true }, redFlags: [], lastUpdatedAt: "2026-01-01T00:00:00.000Z"
} as PersonalAgentProfile;

describe("profile persistence", () => {
  it("saves normalized profile and loads an independent copy", async () => {
    const store = new InMemoryProfilePersistence();
    const saved = await saveMasterProfile(store, { ...profile, displayName: "  Vibhav  " }, "2026-09-08T12:00:00.000Z");
    expect(saved.displayName).toBe("Vibhav");
    const loaded = await loadMasterProfile(store);
    expect(loaded.displayName).toBe("Vibhav");
    expect(loaded).not.toBe(saved);
  });
});
