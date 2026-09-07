import { describe, expect, it } from "vitest";
import { SupabaseProfilePersistence } from "../src/integrations/supabase-profile-repository.js";
import type { SupabaseClientLike } from "../src/integrations/supabase-repository.js";
import { defaultCandidateProfile } from "../src/domain/profile.js";

function fakeClient(rows: unknown[]): SupabaseClientLike {
  return {
    from: () => {
      const builder = {
        eq: () => builder,
        order: async () => ({ data: rows, error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return {
        upsert: async () => ({ error: null }),
        select: () => builder,
      };
    },
  };
}

describe("Supabase profile persistence", () => {
  it("hydrates a stored candidate profile", async () => {
    const persistence = new SupabaseProfilePersistence(fakeClient([{
      user_id: "user-1",
      skills: ["TypeScript"],
      evidence: [{ skill: "TypeScript", evidence: "Production work", strength: 1 }],
      preferred_work_modes: ["remote"],
      minimum_hourly_usd: 12,
      minimum_fixed_usd: 5,
    }]), "user-1");
    await expect(persistence.getProfile()).resolves.toEqual({
      skills: ["TypeScript"],
      evidence: [{ skill: "TypeScript", evidence: "Production work", strength: 1 }],
      preferredWorkModes: ["remote"],
      minimumHourlyUsd: 12,
      minimumFixedUsd: 5,
    });
  });

  it("returns undefined when no profile exists and accepts the default profile", async () => {
    const persistence = new SupabaseProfilePersistence(fakeClient([]), "user-1");
    await expect(persistence.getProfile()).resolves.toBeUndefined();
    await expect(persistence.saveProfile(defaultCandidateProfile)).resolves.toBeUndefined();
  });
});
