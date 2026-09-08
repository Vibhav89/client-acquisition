import { normalizeOnboardingProfile, validateOnboardingProfile } from "../domain/onboarding.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { ProfilePersistencePort } from "../domain/profile-persistence.js";

export async function saveMasterProfile(store: ProfilePersistencePort, profile: PersonalAgentProfile, now = new Date().toISOString()): Promise<PersonalAgentProfile> {
  const validation = validateOnboardingProfile(profile);
  if (!validation.valid) throw new Error(`Invalid master profile: ${validation.missing.join(", ")}`);
  const normalized = normalizeOnboardingProfile(profile, now);
  await store.saveProfile(normalized);
  return normalized;
}

export async function loadMasterProfile(store: ProfilePersistencePort): Promise<PersonalAgentProfile> {
  const profile = await store.getProfile();
  if (!profile) throw new Error("Master profile has not been configured");
  return profile;
}
