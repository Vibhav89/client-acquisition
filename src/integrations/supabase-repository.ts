import type { ApprovalRequest } from "../domain/approval.js";
import type { Opportunity } from "../domain/opportunity.js";
import type { PersistencePort } from "../domain/persistence.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { ProfilePersistencePort } from "../domain/profile-persistence.js";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };
interface QueryBuilder extends PromiseLike<QueryResult> {
  eq(column: string, value: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): PromiseLike<QueryResult>;
}
export interface SupabaseClientLike {
  from(table: string): {
    upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): PromiseLike<{ error: { message: string } | null }>;
    select(columns?: string): QueryBuilder;
  };
}

function opportunityRow(userId: string, opportunity: Opportunity): Record<string, unknown> {
  return {
    id: opportunity.id, user_id: userId, source: opportunity.source, source_url: opportunity.sourceUrl,
    title: opportunity.title, description: opportunity.description, skills: opportunity.skills, work_mode: opportunity.workMode,
    ...(opportunity.location === undefined ? {} : { location: opportunity.location }),
    ...(opportunity.budget === undefined ? {} : { budget: opportunity.budget }),
    ...(opportunity.client === undefined ? {} : { client: opportunity.client }),
    status: opportunity.status, discovered_at: opportunity.discoveredAt,
  };
}

export class SupabasePersistence implements PersistencePort {
  constructor(private readonly client: SupabaseClientLike, private readonly userId: string) {}
  async saveOpportunity(opportunity: Opportunity): Promise<void> {
    const { error } = await this.client.from("opportunities").upsert(opportunityRow(this.userId, opportunity), { onConflict: "user_id,source,source_url" });
    if (error) throw new Error(`Failed to save opportunity: ${error.message}`);
  }
  async saveApproval(request: ApprovalRequest): Promise<void> {
    const { error } = await this.client.from("approval_requests").upsert({ id: request.id, user_id: this.userId, opportunity_id: request.opportunityId, proposal: request.proposal, state: request.state, created_at: request.createdAt, ...(request.decidedAt === undefined ? {} : { decided_at: request.decidedAt }) });
    if (error) throw new Error(`Failed to save approval: ${error.message}`);
  }
  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const { data, error } = await this.client.from("opportunities").select("*").eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read opportunity: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? this.fromRow(row) : undefined;
  }
  async listOpportunities(): Promise<Opportunity[]> {
    const { data, error } = await this.client.from("opportunities").select("*").eq("user_id", this.userId).order("discovered_at", { ascending: false });
    if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
    return (data ?? []).map((row) => this.fromRow(row as Record<string, unknown>));
  }
  async listPendingApprovals(): Promise<ApprovalRequest[]> {
    const { data, error } = await this.client.from("approval_requests").select("*").eq("user_id", this.userId);
    if (error) throw new Error(`Failed to list approvals: ${error.message}`);
    return (data ?? []).filter((row) => (row as Record<string, unknown>).state === "pending").map((row) => this.approvalFromRow(row as Record<string, unknown>));
  }
  private fromRow(row: Record<string, unknown>): Opportunity {
    const budget = row.budget && typeof row.budget === "object" ? row.budget as Opportunity["budget"] : undefined;
    const client = row.client && typeof row.client === "object" ? row.client as Opportunity["client"] : undefined;
    return { id: String(row.id), source: String(row.source), sourceUrl: String(row.source_url), title: String(row.title), description: String(row.description), skills: Array.isArray(row.skills) ? row.skills.map(String) : [], workMode: row.work_mode as Opportunity["workMode"], ...(typeof row.location === "string" ? { location: row.location } : {}), ...(budget === undefined ? {} : { budget }), ...(client === undefined ? {} : { client }), status: row.status as Opportunity["status"], discoveredAt: String(row.discovered_at) };
  }
  private approvalFromRow(row: Record<string, unknown>): ApprovalRequest {
    return { id: String(row.id), opportunityId: String(row.opportunity_id), proposal: String(row.proposal), state: row.state as ApprovalRequest["state"], createdAt: String(row.created_at), ...(typeof row.decided_at === "string" ? { decidedAt: row.decided_at } : {}) };
  }
}

export class SupabaseProfilePersistence implements ProfilePersistencePort {
  constructor(private readonly client: SupabaseClientLike, private readonly userId: string) {}
  async saveProfile(profile: PersonalAgentProfile): Promise<void> {
    const { error } = await this.client.from("profiles").upsert({ user_id: this.userId, display_name: profile.displayName, skills: profile.skills, evidence: profile.evidence, preferred_work_modes: profile.preferredWorkModes, minimum_hourly_usd: profile.negotiation.minimumHourlyUsd ?? null, minimum_fixed_usd: profile.negotiation.minimumFixedUsd ?? null, master_profile: profile, updated_at: profile.lastUpdatedAt }, { onConflict: "user_id" });
    if (error) throw new Error(`Failed to save master profile: ${error.message}`);
  }
  async getProfile(): Promise<PersonalAgentProfile | undefined> {
    const { data, error } = await this.client.from("profiles").select("master_profile").eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read master profile: ${error.message}`);
    const value = (data?.[0] as Record<string, unknown> | undefined)?.master_profile;
    if (!value || typeof value !== "object") return undefined;
    return value as PersonalAgentProfile;
  }
}
