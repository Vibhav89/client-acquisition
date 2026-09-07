import type { CandidateProfile } from "../domain/opportunity.js";
import type { ProfilePersistencePort } from "../domain/profile-persistence.js";
import type { SupabaseClientLike } from "./supabase-repository.js";

const workModes = new Set(["remote", "hybrid", "onsite", "unknown"]);

export class SupabaseProfilePersistence implements ProfilePersistencePort {
  constructor(private readonly client: SupabaseClientLike, private readonly userId: string) {}

  async getProfile(): Promise<CandidateProfile | undefined> {
    const { data, error } = await this.client.from("profiles").select("*").eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read profile: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const evidence = Array.isArray(row.evidence) ? row.evidence.filter((item): item is { skill: string; evidence: string; strength: number } => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      return typeof value.skill === "string" && typeof value.evidence === "string" && typeof value.strength === "number";
    }) : [];
    const preferredWorkModes = Array.isArray(row.preferred_work_modes)
      ? row.preferred_work_modes.filter((item): item is CandidateProfile["preferredWorkModes"][number] => workModes.has(String(item)))
      : [];
    return {
      skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
      evidence,
      preferredWorkModes,
      ...(typeof row.minimum_hourly_usd === "number" ? { minimumHourlyUsd: row.minimum_hourly_usd } : {}),
      ...(typeof row.minimum_fixed_usd === "number" ? { minimumFixedUsd: row.minimum_fixed_usd } : {}),
    };
  }

  async saveProfile(profile: CandidateProfile): Promise<void> {
    const { error } = await this.client.from("profiles").upsert({
      user_id: this.userId,
      skills: profile.skills,
      evidence: profile.evidence,
      preferred_work_modes: profile.preferredWorkModes,
      ...(profile.minimumHourlyUsd === undefined ? {} : { minimum_hourly_usd: profile.minimumHourlyUsd }),
      ...(profile.minimumFixedUsd === undefined ? {} : { minimum_fixed_usd: profile.minimumFixedUsd }),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Failed to save profile: ${error.message}`);
  }
}
