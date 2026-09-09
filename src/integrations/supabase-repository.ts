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
    delete?(): QueryBuilder;
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

  async saveClient(client: any): Promise<void> {
    const { error } = await this.client.from("clients").upsert({
      id: client.id, user_id: this.userId, opportunity_ids: client.opportunityIds, source: client.source, source_url: client.sourceUrl,
      name: client.name ?? null, country: client.country ?? null, verified: client.verified ?? null, hire_rate: client.hireRate ?? null, total_spent: client.totalSpent ?? null,
      stage: client.stage, fit_score: client.fitScore, legitimacy_score: client.legitimacyScore, priority_score: client.priorityScore, summary: client.summary,
      needs: client.needs, objections: client.objections, approach_angle: client.approachAngle, suggested_price_usd: client.suggestedPriceUsd ?? null,
      suggested_delivery_days: client.suggestedDeliveryDays ?? null, next_action: client.nextAction, created_at: client.createdAt, updated_at: client.updatedAt,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save client: ${error.message}`);
  }

  async getClient(id: string): Promise<any> {
    const { data, error } = await this.client.from("clients").select("*").eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read client: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? this.clientFromRow(row) : undefined;
  }

  async listClients(): Promise<any[]> {
    const { data, error } = await this.client.from("clients").select("*").eq("user_id", this.userId).order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to list clients: ${error.message}`);
    return (data ?? []).map((row) => this.clientFromRow(row as Record<string, unknown>));
  }

  async saveMessage(message: any): Promise<void> {
    const { error } = await this.client.from("conversations").upsert({
      id: message.id, user_id: this.userId, client_id: message.clientId, direction: message.direction, body: message.body, channel: message.channel ?? null, timestamp: message.timestamp,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save message: ${error.message}`);
  }

  async listMessages(clientId: string): Promise<any[]> {
    const { data, error } = await this.client.from("conversations").select("*").eq("client_id", clientId).eq("user_id", this.userId).order("timestamp", { ascending: true });
    if (error) throw new Error(`Failed to list messages: ${error.message}`);
    return (data ?? []).map((row) => this.messageFromRow(row as Record<string, unknown>));
  }

  async saveDeal(deal: any): Promise<void> {
    const { error } = await this.client.from("deals").upsert({
      id: deal.id, user_id: this.userId, client_id: deal.clientId, state: deal.state, terms: deal.terms, rationale: deal.rationale, created_at: deal.createdAt, decided_at: deal.decidedAt ?? null,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save deal: ${error.message}`);
  }

  async getDeal(id: string): Promise<any> {
    const { data, error } = await this.client.from("deals").select("*").eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read deal: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? this.dealFromRow(row) : undefined;
  }

  async listDeals(): Promise<any[]> {
    const { data, error } = await this.client.from("deals").select("*").eq("user_id", this.userId).order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list deals: ${error.message}`);
    return (data ?? []).map((row) => this.dealFromRow(row as Record<string, unknown>));
  }

  async saveApplication(app: any): Promise<void> {
    const { error } = await this.client.from("applications").upsert({
      id: app.id, user_id: this.userId, client_id: app.clientId ?? null, opportunity_id: app.opportunityId, source: app.source, source_url: app.sourceUrl, status: app.status, notes: app.notes ?? null, created_at: app.createdAt, updated_at: app.updatedAt,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save application: ${error.message}`);
  }

  async getApplication(id: string): Promise<any> {
    const { data, error } = await this.client.from("applications").select("*").eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read application: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? this.applicationFromRow(row) : undefined;
  }

  async listApplications(): Promise<any[]> {
    const { data, error } = await this.client.from("applications").select("*").eq("user_id", this.userId).order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to list applications: ${error.message}`);
    return (data ?? []).map((row) => this.applicationFromRow(row as Record<string, unknown>));
  }

  async saveEarnings(record: any): Promise<void> {
    if (!Number.isFinite(record.amount) || record.amount <= 0) throw new Error("Earnings amount must be greater than zero");
    const { error } = await this.client.from("earnings").upsert({
      id: record.id, user_id: this.userId, client_id: record.clientId ?? null, application_id: record.applicationId ?? null, project_title: record.projectTitle, amount: record.amount, currency: record.currency, received_at: record.receivedAt, notes: record.notes ?? null,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save earnings: ${error.message}`);
  }

  async listEarnings(): Promise<any[]> {
    const { data, error } = await this.client.from("earnings").select("*").eq("user_id", this.userId).order("received_at", { ascending: false });
    if (error) throw new Error(`Failed to list earnings: ${error.message}`);
    return (data ?? []).map((row) => this.earningsFromRow(row as Record<string, unknown>));
  }

  async saveHistoryEvent(event: any): Promise<void> {
    const { error } = await this.client.from("event_history").upsert({
      id: event.id, user_id: this.userId, type: event.type, timestamp: event.timestamp ?? event.createdAt ?? new Date().toISOString(),
      entity_type: event.entityType, entity_id: event.entityId, source: event.source ?? null, summary: event.summary,
      metadata: event.metadata ?? null, requires_user_approval: event.requiresUserApproval ?? false,
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save history event: ${error.message}`);
  }

  async listHistoryEvents(filter: any = {}): Promise<any[]> {
    let query = this.client.from("event_history").select("*").eq("user_id", this.userId);
    if (filter.type) query = query.eq("type", filter.type);
    if (filter.entityType) query = query.eq("entity_type", filter.entityType);
    if (filter.entityId) query = query.eq("entity_id", filter.entityId);
    if (filter.source) query = query.eq("source", filter.source);
    const { data, error } = await query.order("timestamp", { ascending: false });
    if (error) throw new Error(`Failed to list history events: ${error.message}`);
    return (data ?? []).map((row) => this.historyEventFromRow(row as Record<string, unknown>));
  }

  async saveLearningEvent(event: any): Promise<void> {
    const { error } = await this.client.from("learning_events").upsert({
      id: event.id, user_id: this.userId, client_id: event.clientId ?? null, opportunity_id: event.opportunityId ?? null,
      source: event.source ?? null, outcome: event.outcome, stage: event.stage ?? null, reason: event.reason ?? null,
      match_score: event.matchScore ?? null, risk_score: event.riskScore ?? null, created_at: event.createdAt ?? new Date().toISOString(),
    }, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save learning event: ${error.message}`);
  }

  async listLearningEvents(): Promise<any[]> {
    const { data, error } = await this.client.from("learning_events").select("*").eq("user_id", this.userId).order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list learning events: ${error.message}`);
    return (data ?? []).map((row) => this.learningEventFromRow(row as Record<string, unknown>));
  }

  private historyEventFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), type: String(row.type), timestamp: String(row.timestamp), entityType: String(row.entity_type), entityId: String(row.entity_id), ...(typeof row.source === "string" ? { source: row.source } : {}), summary: String(row.summary), ...(row.metadata ? { metadata: row.metadata } : {}), requiresUserApproval: Boolean(row.requires_user_approval) };
  }

  private learningEventFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), ...(typeof row.client_id === "string" ? { clientId: row.client_id } : {}), ...(typeof row.opportunity_id === "string" ? { opportunityId: row.opportunity_id } : {}), ...(typeof row.source === "string" ? { source: row.source } : {}), outcome: String(row.outcome), ...(typeof row.stage === "string" ? { stage: row.stage } : {}), ...(typeof row.reason === "string" ? { reason: row.reason } : {}), ...(typeof row.match_score === "number" ? { matchScore: row.match_score } : {}), ...(typeof row.risk_score === "number" ? { riskScore: row.risk_score } : {}), createdAt: String(row.created_at) };
  }

  private clientFromRow(row: Record<string, unknown>): any {
    return {
      id: String(row.id), opportunityIds: Array.isArray(row.opportunity_ids) ? row.opportunity_ids.map(String) : [], source: String(row.source), sourceUrl: String(row.source_url),
      ...(typeof row.name === "string" ? { name: row.name } : {}), ...(typeof row.country === "string" ? { country: row.country } : {}), ...(typeof row.verified === "boolean" ? { verified: row.verified } : {}),
      ...(typeof row.hire_rate === "number" ? { hireRate: row.hire_rate } : {}), ...(typeof row.total_spent === "number" ? { totalSpent: row.total_spent } : {}),
      stage: String(row.stage), fitScore: Number(row.fit_score), legitimacyScore: Number(row.legitimacy_score), priorityScore: Number(row.priority_score),
      summary: String(row.summary), needs: Array.isArray(row.needs) ? row.needs.map(String) : [], objections: Array.isArray(row.objections) ? row.objections.map(String) : [],
      approachAngle: String(row.approach_angle), ...(typeof row.suggested_price_usd === "number" ? { suggestedPriceUsd: row.suggested_price_usd } : {}),
      ...(typeof row.suggested_delivery_days === "number" ? { suggestedDeliveryDays: row.suggested_delivery_days } : {}), nextAction: String(row.next_action),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  async saveDocument(doc: any): Promise<void> {
    const { error } = await this.client.from("documents").upsert({
      id: doc.id, user_id: this.userId, title: doc.title, document_type: doc.documentType,
      file_name: doc.fileName, file_type: doc.fileType, file_size_bytes: doc.fileSizeBytes,
      content_text: doc.contentText, skills: doc.skills, target_role: doc.targetRole ?? null,
      version: doc.version, status: doc.status, metadata: doc.metadata,
      created_at: doc.createdAt, updated_at: doc.updatedAt,
    });
    if (error) throw new Error(`Failed to save document: ${error.message}`);
  }
  async getDocument(id: string): Promise<any | undefined> {
    const { data, error } = await this.client.from("documents").select("*").eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to read document: ${error.message}`);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? this.documentFromRow(row) : undefined;
  }
  async listDocuments(): Promise<any[]> {
    const { data, error } = await this.client.from("documents").select("*").eq("user_id", this.userId).order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list documents: ${error.message}`);
    return (data ?? []).map((row) => this.documentFromRow(row as Record<string, unknown>));
  }
  async deleteDocument(id: string): Promise<void> {
    const builder = this.client.from("documents");
    if (!builder.delete) return;
    const { error } = await builder.delete().eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(`Failed to delete document: ${error.message}`);
  }

  private documentFromRow(row: Record<string, unknown>): any {
    return {
      id: String(row.id), userId: String(row.user_id), title: String(row.title), documentType: row.document_type as any,
      fileName: String(row.file_name), fileType: row.file_type as any, fileSizeBytes: Number(row.file_size_bytes),
      contentText: String(row.content_text), skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
      ...(typeof row.target_role === "string" ? { targetRole: row.target_role } : {}), version: String(row.version),
      status: row.status as any, metadata: typeof row.metadata === "object" && row.metadata ? (row.metadata as Record<string, unknown>) : {},
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  private messageFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), clientId: String(row.client_id), direction: row.direction as "inbound" | "outbound", body: String(row.body), ...(typeof row.channel === "string" ? { channel: row.channel } : {}), timestamp: String(row.timestamp) };
  }

  private dealFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), clientId: String(row.client_id), state: row.state as any, terms: row.terms as any, rationale: Array.isArray(row.rationale) ? row.rationale.map(String) : [], createdAt: String(row.created_at), ...(typeof row.decided_at === "string" ? { decidedAt: row.decided_at } : {}) };
  }

  private applicationFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), ...(typeof row.client_id === "string" ? { clientId: row.client_id } : {}), opportunityId: String(row.opportunity_id), source: String(row.source), sourceUrl: String(row.source_url), status: row.status as any, ...(typeof row.notes === "string" ? { notes: row.notes } : {}), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
  }

  private earningsFromRow(row: Record<string, unknown>): any {
    return { id: String(row.id), ...(typeof row.client_id === "string" ? { clientId: row.client_id } : {}), ...(typeof row.application_id === "string" ? { applicationId: row.application_id } : {}), projectTitle: String(row.project_title), amount: Number(row.amount), currency: String(row.currency), receivedAt: String(row.received_at), ...(typeof row.notes === "string" ? { notes: row.notes } : {}) };
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
