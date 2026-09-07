import type { Opportunity, RiskResult } from "./opportunity.js";

const riskTerms = [
  "pay fee",
  "registration fee",
  "deposit",
  "crypto payment",
  "buy gift card",
  "move to telegram",
  "move to whatsapp",
  "send money",
];

export function assessRisk(opportunity: Opportunity): RiskResult {
  const text = `${opportunity.title} ${opportunity.description}`.toLowerCase();
  const signals = riskTerms
    .filter((term) => text.includes(term))
    .map((term) => `Contains high-risk phrase: ${term}`);

  if (opportunity.budget?.currency && opportunity.budget.currency.toUpperCase() !== "USD") {
    signals.push("Compensation is not stated in USD.");
  }
  if (opportunity.sourceUrl.startsWith("http://")) {
    signals.push("Opportunity URL does not use HTTPS.");
  }
  if (opportunity.client?.verified === false) {
    signals.push("Client is explicitly unverified.");
  }

  const score = Math.min(100, signals.length * 25);
  return {
    level: score >= 50 ? "high" : score >= 25 ? "medium" : "low",
    score,
    signals,
  };
}
