import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { ProfilePersistencePort } from "../domain/profile-persistence.js";
import type { SupabaseClientLike } from "./supabase-repository.js";

export class SupabaseProfilePersistence implements ProfilePersistencePort {
  constructor(private readonly client: SupabaseClientLike, private readonly userId: string) {}

  async getProfile(): Promise<PersonalAgentProfile | undefined> {
    const { data, error } = await this.client.from("profiles").select("master_profile").eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read master profile: ${error.message}`);
    const value = (data?.[0] as Record<string, unknown> | undefined)?.master_profile;
    if (!value || typeof value !== "object") return undefined;
    return value as PersonalAgentProfile;
  }

  async saveProfile(profile: PersonalAgentProfile): Promise<void> {
    const { error } = await this.client.from("profiles").upsert({
      user_id: this.userId,
      display_name: profile.displayName,
      skills: profile.skills,
      evidence: profile.evidence,
      preferred_work_modes: profile.preferredWorkModes,
      minimum_hourly_usd: profile.negotiation.minimumHourlyUsd ?? null,
      minimum_fixed_usd: profile.negotiation.minimumFixedUsd ?? null,
      master_profile: profile,
      updated_at: profile.lastUpdatedAt,
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Failed to save master profile: ${error.message}`);
  }
}
