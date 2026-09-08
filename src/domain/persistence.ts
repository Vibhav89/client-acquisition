import type { ApprovalRequest } from "./approval.js";
import type { Opportunity } from "./opportunity.js";
import type { ClientRecord, ConversationMessage } from "./client.js";
import type { DealApproval } from "./deal.js";
import type { ApplicationRecord } from "./application-tracking.js";
import type { EarningsRecord } from "./earnings.js";

export interface PersistencePort {
  saveOpportunity(opportunity: Opportunity): void | Promise<void>;
  saveApproval(request: ApprovalRequest): void | Promise<void>;
  getOpportunity(id: string): Opportunity | undefined | Promise<Opportunity | undefined>;
  listOpportunities(): Opportunity[] | Promise<Opportunity[]>;
  listPendingApprovals(): ApprovalRequest[] | Promise<ApprovalRequest[]>;
  saveClient?(client: ClientRecord): void | Promise<void>;
  getClient?(id: string): ClientRecord | undefined | Promise<ClientRecord | undefined>;
  listClients?(): ClientRecord[] | Promise<ClientRecord[]>;
  saveMessage?(message: ConversationMessage): void | Promise<void>;
  listMessages?(clientId: string): ConversationMessage[] | Promise<ConversationMessage[]>;
  saveDeal?(deal: DealApproval): void | Promise<void>;
  getDeal?(id: string): DealApproval | undefined | Promise<DealApproval | undefined>;
  listDeals?(): DealApproval[] | Promise<DealApproval[]>;
  saveApplication?(application: ApplicationRecord): void | Promise<void>;
  getApplication?(id: string): ApplicationRecord | undefined | Promise<ApplicationRecord | undefined>;
  listApplications?(): ApplicationRecord[] | Promise<ApplicationRecord[]>;
  saveEarnings?(earnings: EarningsRecord): void | Promise<void>;
  listEarnings?(): EarningsRecord[] | Promise<EarningsRecord[]>;
  saveHistoryEvent?(event: any): void | Promise<void>;
  listHistoryEvents?(filter?: any): any[] | Promise<any[]>;
  saveLearningEvent?(event: any): void | Promise<void>;
  listLearningEvents?(): any[] | Promise<any[]>;
}

export class InMemoryPersistence implements PersistencePort {
  private readonly opportunities = new Map<string, Opportunity>();
  private readonly approvals = new Map<string, ApprovalRequest>();
  private readonly clients = new Map<string, ClientRecord>();
  private readonly messages = new Map<string, ConversationMessage>();
  private readonly deals = new Map<string, DealApproval>();
  private readonly applications = new Map<string, ApplicationRecord>();
  private readonly earnings = new Map<string, EarningsRecord>();
  private readonly historyEvents = new Map<string, any>();
  private readonly learningEvents = new Map<string, any>();

  saveOpportunity(opportunity: Opportunity): void { this.opportunities.set(opportunity.id, opportunity); }
  saveApproval(request: ApprovalRequest): void {
    if (!this.opportunities.has(request.opportunityId)) throw new Error("Approval references an unknown opportunity");
    this.approvals.set(request.id, request);
  }
  getOpportunity(id: string): Opportunity | undefined { return this.opportunities.get(id); }
  listOpportunities(): Opportunity[] { return [...this.opportunities.values()]; }
  listPendingApprovals(): ApprovalRequest[] { return [...this.approvals.values()].filter((request) => request.state === "pending"); }

  saveClient(client: ClientRecord): void { this.clients.set(client.id, structuredClone(client)); }
  getClient(id: string): ClientRecord | undefined { const val = this.clients.get(id); return val ? structuredClone(val) : undefined; }
  listClients(): ClientRecord[] { return [...this.clients.values()].map((c) => structuredClone(c)); }

  saveMessage(message: ConversationMessage): void { this.messages.set(message.id, structuredClone(message)); }
  listMessages(clientId: string): ConversationMessage[] { return [...this.messages.values()].filter((m) => m.clientId === clientId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((m) => structuredClone(m)); }

  saveDeal(deal: DealApproval): void { this.deals.set(deal.id, structuredClone(deal)); }
  getDeal(id: string): DealApproval | undefined { const val = this.deals.get(id); return val ? structuredClone(val) : undefined; }
  listDeals(): DealApproval[] { return [...this.deals.values()].map((d) => structuredClone(d)); }

  saveApplication(application: ApplicationRecord): void { this.applications.set(application.id, structuredClone(application)); }
  getApplication(id: string): ApplicationRecord | undefined { const val = this.applications.get(id); return val ? structuredClone(val) : undefined; }
  listApplications(): ApplicationRecord[] { return [...this.applications.values()].map((a) => structuredClone(a)); }

  saveEarnings(record: EarningsRecord): void { if (!Number.isFinite(record.amount) || record.amount <= 0) throw new Error("Earnings amount must be greater than zero"); this.earnings.set(record.id, structuredClone(record)); }
  listEarnings(): EarningsRecord[] { return [...this.earnings.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((e) => structuredClone(e)); }

  saveHistoryEvent(event: any): void { this.historyEvents.set(event.id, structuredClone(event)); }
  listHistoryEvents(filter: any = {}): any[] {
    return [...this.historyEvents.values()]
      .filter((e) => !filter.type || e.type === filter.type)
      .filter((e) => !filter.entityType || e.entityType === filter.entityType)
      .filter((e) => !filter.entityId || e.entityId === filter.entityId)
      .filter((e) => !filter.source || e.source === filter.source)
      .sort((a, b) => (b.timestamp ?? b.createdAt ?? "").localeCompare(a.timestamp ?? a.createdAt ?? ""))
      .map((e) => structuredClone(e));
  }

  saveLearningEvent(event: any): void { this.learningEvents.set(event.id, structuredClone(event)); }
  listLearningEvents(): any[] { return [...this.learningEvents.values()].map((e) => structuredClone(e)); }
}
