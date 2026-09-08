import { transitionDealApproval, type DealApproval, type DealTerms } from "../domain/deal.js";
import type { NegotiationPolicy } from "../domain/master-profile.js";

export class InMemoryDealStore {
  private readonly deals = new Map<string, DealApproval>();
  upsert(deal: DealApproval): void { this.deals.set(deal.id, structuredClone(deal)); }
  get(id: string): DealApproval | undefined { const value = this.deals.get(id); return value ? structuredClone(value) : undefined; }
  list(): DealApproval[] { return [...this.deals.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((v) => structuredClone(v)); }
}

export function validateDealTerms(terms: DealTerms, policy: NegotiationPolicy): string[] {
  const errors: string[] = [];
  if (!terms.scope.trim()) errors.push("Scope confirmation is required");
  if (!Number.isFinite(terms.priceUsd) || terms.priceUsd <= 0) errors.push("Price must be greater than zero");
  if (!Number.isInteger(terms.deliveryDays) || terms.deliveryDays <= 0) errors.push("Delivery days must be a positive integer");
  if (terms.deliverables.length === 0) errors.push("At least one deliverable is required");
  if (policy.minimumFixedUsd !== undefined && terms.priceUsd < policy.minimumFixedUsd) errors.push(`Price is below minimum fixed price of $${policy.minimumFixedUsd}`);
  if (policy.requireScopeConfirmation && !terms.scope.trim()) errors.push("Scope confirmation is required by policy");
  return errors;
}

export function createDealForFinalApproval(clientId: string, terms: DealTerms, policy: NegotiationPolicy, rationale: string[], now = new Date().toISOString()): DealApproval {
  const errors = validateDealTerms(terms, policy);
  if (errors.length) throw new Error(`Invalid deal terms: ${errors.join("; ")}`);
  return { id: `deal:${clientId}:${now}`, clientId, state: "pending_final_approval", terms: structuredClone(terms), rationale: [...rationale], createdAt: now };
}

export function decideDeal(deal: DealApproval, decision: "approved" | "rejected", now = new Date().toISOString()): DealApproval {
  return transitionDealApproval(deal, decision, now);
}
