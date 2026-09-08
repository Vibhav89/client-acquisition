export type ApplicationStatus = "draft" | "approved" | "applied" | "interview" | "won" | "lost";

export interface ApplicationRecord {
  id: string;
  clientId?: string | undefined;
  opportunityId: string;
  source: string;
  sourceUrl: string;
  status: ApplicationStatus;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ["approved", "lost"],
  approved: ["applied", "lost"],
  applied: ["interview", "won", "lost"],
  interview: ["won", "lost"],
  won: [],
  lost: [],
};

export function transitionApplication(application: ApplicationRecord, next: ApplicationStatus, now = new Date().toISOString()): ApplicationRecord {
  if (!transitions[application.status].includes(next)) throw new Error(`Invalid application transition: ${application.status} -> ${next}`);
  return { ...application, status: next, updatedAt: now };
}

export class InMemoryApplicationStore {
  private readonly records = new Map<string, ApplicationRecord>();
  upsert(record: ApplicationRecord): void { this.records.set(record.id, structuredClone(record)); }
  get(id: string): ApplicationRecord | undefined { const value = this.records.get(id); return value ? structuredClone(value) : undefined; }
  list(): ApplicationRecord[] { return [...this.records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((v) => structuredClone(v)); }
}
