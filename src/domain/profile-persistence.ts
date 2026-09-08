import type { PersonalAgentProfile } from "./master-profile.js";

export interface ProfilePersistencePort {
  getProfile(): PersonalAgentProfile | undefined | Promise<PersonalAgentProfile | undefined>;
  saveProfile(profile: PersonalAgentProfile): void | Promise<void>;
}

export class InMemoryProfilePersistence implements ProfilePersistencePort {
  private profile?: PersonalAgentProfile;

  saveProfile(profile: PersonalAgentProfile): void {
    this.profile = structuredClone(profile);
  }

  getProfile(): PersonalAgentProfile | undefined {
    return this.profile ? structuredClone(this.profile) : undefined;
  }
}
