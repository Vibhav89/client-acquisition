import type { CandidateProfile } from "./opportunity.js";

export interface ProfilePersistencePort {
  getProfile(): CandidateProfile | undefined | Promise<CandidateProfile | undefined>;
  saveProfile(profile: CandidateProfile): void | Promise<void>;
}
