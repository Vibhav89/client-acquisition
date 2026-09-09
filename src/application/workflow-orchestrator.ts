import type { ClientRecord } from "../domain/client.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";
import type { Opportunity } from "../domain/opportunity.js";
import { createDealForFinalApproval, decideDeal, InMemoryDealStore } from "./deal-service.js";
import type { DealApproval, DealTerms } from "../domain/deal.js";
import { InMemoryApplicationStore, transitionApplication, type ApplicationRecord } from "../domain/application-tracking.js";

export class PersonalWorkflowOrchestrator {
  private readonly deals = new InMemoryDealStore();
  private readonly applications = new InMemoryApplicationStore();

  prepareDeal(client: ClientRecord, opportunity: Opportunity, profile: PersonalAgentProfile, terms: DealTerms, rationale: string[], now = new Date().toISOString()): DealApproval {
    if (terms.scope.trim() === "" || terms.deliverables.length === 0) throw new Error("Final deal requires confirmed scope and deliverables");
    const deal = createDealForFinalApproval(client.id, terms, profile.negotiation, rationale, now);
    this.deals.upsert(deal);
    return deal;
  }

  approveDeal(id: string, now = new Date().toISOString()): DealApproval {
    const deal = this.deals.get(id); if (!deal) throw new Error("Deal not found");
    const updated = decideDeal(deal, "approved", now); this.deals.upsert(updated); return updated;
  }

  rejectDeal(id: string, now = new Date().toISOString()): DealApproval {
    const deal = this.deals.get(id); if (!deal) throw new Error("Deal not found");
    const updated = decideDeal(deal, "rejected", now); this.deals.upsert(updated); return updated;
  }

  listDeals(): DealApproval[] { return this.deals.list(); }

  createApplication(opportunity: Opportunity, clientId?: string, now = new Date().toISOString()): ApplicationRecord {
    const application: ApplicationRecord = { id: `application:${opportunity.id}`, opportunityId: opportunity.id, clientId, source: opportunity.source, sourceUrl: opportunity.sourceUrl, status: "draft", createdAt: now, updatedAt: now };
    this.applications.upsert(application); return application;
  }

  approveApplication(id: string, now = new Date().toISOString()): ApplicationRecord {
    const application = this.applications.get(id); if (!application) throw new Error("Application not found");
    const updated = transitionApplication(application, "approved", now); this.applications.upsert(updated); return updated;
  }

  markApplied(id: string, now = new Date().toISOString()): ApplicationRecord {
    const application = this.applications.get(id); if (!application) throw new Error("Application not found");
    const updated = transitionApplication(application, "applied", now); this.applications.upsert(updated); return updated;
  }

  listApplications(): ApplicationRecord[] { return this.applications.list(); }
}
