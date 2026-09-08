import type { ConversationMessage, ClientRecord } from "./client.js";
import type { PersonalAgentProfile } from "./master-profile.js";
import { classifyConversation, type ConversationIntent } from "./conversation.js";

export type NegotiationSignal =
  | "buying_signal"
  | "price_pressure"
  | "scope_creep"
  | "payment_risk"
  | "off_platform_risk"
  | "commitment"
  | "objection"
  | "ambiguity";

export interface NegotiationAssessment {
  intent: ConversationIntent;
  signals: NegotiationSignal[];
  confidence: number;
  strategy: "answer" | "clarify" | "protect_margin" | "hold_for_approval";
  suggestedReply: string;
  requiresUserApproval: boolean;
  escalateToFinalApproval: boolean;
  reasons: string[];
}

const buyingSignals = /sounds good|looks good|i(?:'m| am) interested|let(?:'s| us) do it|go ahead|can you start|when can we start|we want to hire/i;
const pressureSignals = /cheaper|lower your price|best price|discount|budget is only|too expensive|can't afford|reduce (the )?(price|rate)/i;
const scopeSignals = /also|additionally|one more|another feature|extra|while you(?:'re| are) at it|can you also/i;
const paymentRiskSignals = /crypto|bitcoin|gift card|pay.*deposit|deposit.*pay|send money|pay.*fee|registration fee|upfront fee/i;
const offPlatformSignals = /telegram|whatsapp|signal|move to (another|private) chat|contact me outside/i;
const objectionSignals = /concern|worried|not sure|hesitant|problem with|issue with|doesn't work for us|too risky/i;
const ambiguitySignals = /maybe|probably|not sure|we(?:'ll| will) decide|depends|tbd|to be determined/i;

export function assessNegotiation(
  message: ConversationMessage,
  client: ClientRecord,
  profile: PersonalAgentProfile,
): NegotiationAssessment {
  const text = message.body;
  const intent = classifyConversation(text);
  const signals: NegotiationSignal[] = [];
  if (buyingSignals.test(text)) signals.push("buying_signal");
  if (pressureSignals.test(text)) signals.push("price_pressure");
  if (scopeSignals.test(text)) signals.push("scope_creep");
  if (paymentRiskSignals.test(text)) signals.push("payment_risk");
  if (offPlatformSignals.test(text)) signals.push("off_platform_risk");
  if (objectionSignals.test(text)) signals.push("objection");
  if (ambiguitySignals.test(text)) signals.push("ambiguity");
  if (intent === "ready_to_close") signals.push("commitment");

  const reasons = [`Detected intent: ${intent}.`, `Client stage: ${client.stage}.`];
  if (signals.length) reasons.push(`Signals: ${signals.join(", ")}.`);

  const hardStop = signals.includes("payment_risk") || signals.includes("off_platform_risk");
  const commitment = signals.includes("commitment");
  const scopeRisk = signals.includes("scope_creep");
  const pricePressure = signals.includes("price_pressure");
  const strategy = hardStop || commitment || (scopeRisk && profile.negotiation.requireFinalApproval)
    ? "hold_for_approval"
    : pricePressure
      ? "protect_margin"
      : intent === "scope" || signals.includes("ambiguity")
        ? "clarify"
        : "answer";

  let suggestedReply = "Thanks for the update. I’ll keep the response aligned with the agreed scope and next step.";
  if (hardStop) suggestedReply = "Thanks for the message. Before proceeding, I need to keep payment and communication terms within the agreed platform/process. Please share the formal project terms there so I can review them.";
  else if (commitment) suggestedReply = "Thanks — I’m interested in moving forward. I’ll confirm the final scope, price, timeline, and terms before we commit.";
  else if (scopeRisk) suggestedReply = "Happy to consider that addition. Let’s confirm whether it is part of the current scope or a separate item, including the impact on price and delivery.";
  else if (pricePressure) suggestedReply = profile.negotiation.maxDiscountPercent > 0
    ? `I can review the price within the agreed scope, with a maximum adjustment of ${profile.negotiation.maxDiscountPercent}%. I’d first confirm the final deliverables and acceptance criteria.`
    : "I’d prefer to keep the quoted rate for the confirmed scope. If the budget is fixed, we can reduce scope or deliverables rather than compromise the agreed quality.";
  else if (objectionSignals.test(text)) suggestedReply = "I understand the concern. Tell me the main point you’d like resolved, and I’ll address it against the current scope and evidence.";
  else if (intent === "scope" || signals.includes("ambiguity")) suggestedReply = "Before I confirm, could you clarify the exact deliverables, acceptance criteria, and any dependencies? That will let me give you a reliable price and timeline.";

  const confidence = Math.min(100, 55 + signals.length * 8 + (intent !== "other" ? 10 : 0));
  return {
    intent,
    signals,
    confidence,
    strategy,
    suggestedReply,
    requiresUserApproval: true,
    escalateToFinalApproval: commitment || hardStop || (profile.negotiation.requireFinalApproval && (pricePressure || scopeRisk)),
    reasons,
  };
}
