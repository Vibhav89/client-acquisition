import { describe, expect, it } from "vitest";
import { SupabaseProfilePersistence } from "../src/integrations/supabase-profile-repository.js";
import type { SupabaseClientLike } from "../src/integrations/supabase-repository.js";
import type { PersonalAgentProfile } from "../src/domain/master-profile.js";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

function fakeClient(rows: unknown[]): SupabaseClientLike {
  return {
    from: () => {
      const builder = {
        eq: () => builder,
        order: async () => ({ data: rows, error: null }),
        then: <TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ): PromiseLike<TResult1 | TResult2> => Promise.resolve({ data: rows, error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined),
      };
      return {
        upsert: async () => ({ error: null }),
        select: () => builder,
      };
    },
  };
}

const sampleProfile: PersonalAgentProfile = {
  displayName: "Test User",
  headline: "Developer",
  bio: "Bio",
  skills: ["TypeScript"],
  evidence: [{ skill: "TypeScript", evidence: "Production work", strength: 1 }],
  preferredWorkModes: ["remote"],
  portfolio: [],
  services: [],
  platformAccounts: [],
  communicationStyle: "professional",
  negotiation: { minimumHourlyUsd: 12, minimumFixedUsd: 5, maxDiscountPercent: 10, requireScopeConfirmation: true, requireFinalApproval: true },
  redFlags: [],
  lastUpdatedAt: "2026-09-09T00:00:00.000Z",
};

describe("Supabase profile persistence", () => {
  it("hydrates a stored candidate profile", async () => {
    const persistence = new SupabaseProfilePersistence(fakeClient([{
      user_id: "user-1",
      master_profile: sampleProfile,
    }]), "user-1");
    await expect(persistence.getProfile()).resolves.toEqual(sampleProfile);
  });

  it("returns undefined when no profile exists and accepts the default profile", async () => {
    const persistence = new SupabaseProfilePersistence(fakeClient([]), "user-1");
    await expect(persistence.getProfile()).resolves.toBeUndefined();
    await expect(persistence.saveProfile(sampleProfile)).resolves.toBeUndefined();
  });
});
