import type { CandidateProfile, Opportunity } from "./opportunity.js";
import type { ClientRecord, ConversationMessage } from "./client.js";

export type ConversationIntent = "scope" | "price" | "timeline" | "proof" | "meeting" | "ready_to_close" | "other";

export interface ConversationDecision {
  intent: ConversationIntent;
  summary: string;
  suggestedReply: string;
  requiresUserApproval: boolean;
  escalateToFinalApproval: boolean;
  reasons: string[];
}

const closeSignals = /deal|finali[sz]e|hire you|start (the )?(project|work)|send (the )?contract|offer|ready to proceed|move forward/i;
const priceSignals = /budget|price|rate|cost|quote|how much|hourly/i;
const timelineSignals = /deadline|timeline|deliver|how long|when can you/i;
const meetingSignals = /call|meeting|zoom|meet|interview/i;
const proofSignals = /portfolio|github|example|previous work|experience|sample/i;
const scopeSignals = /requirement|scope|feature|build|fix|implement|need/i;

export function classifyConversation(text: string): ConversationIntent {
  if (closeSignals.test(text)) return "ready_to_close";
  if (priceSignals.test(text)) return "price";
  if (timelineSignals.test(text)) return "timeline";
  if (meetingSignals.test(text)) return "meeting";
  if (proofSignals.test(text)) return "proof";
  if (scopeSignals.test(text)) return "scope";
  return "other";
}

export function prepareConversationDecision(message: ConversationMessage, client: ClientRecord, opportunity: Opportunity, profile: CandidateProfile): ConversationDecision {
  const intent = classifyConversation(message.body);
  const reasons: string[] = [`Detected intent: ${intent}.`, `Client stage: ${client.stage}.`];
  if (intent === "ready_to_close") {
    return {
      intent,
      summary: "Client appears ready to make or finalize a commitment.",
      suggestedReply: "Thanks — I’m interested in moving forward. I’m reviewing the final scope, price, timeline, and terms now and will confirm shortly.",
      requiresUserApproval: true,
      escalateToFinalApproval: true,
      reasons: [...reasons, "A contract, scope, price, deadline, or other commitment must be confirmed by the user."],
    };
  }

  const matched = opportunity.skills.filter((skill) => profile.skills.some((mine) => mine.toLowerCase() === skill.toLowerCase())).slice(0, 3);
  let suggestedReply = "Thanks for the details. Could you share the highest-priority outcome and any constraints I should account for?";
  if (intent === "price") suggestedReply = client.suggestedPriceUsd ? `Based on the current scope, a working estimate is around $${client.suggestedPriceUsd} USD. I’d confirm the final quote after locking the deliverables.` : "I can quote accurately once we confirm the exact deliverables and definition of done.";
  if (intent === "timeline") suggestedReply = client.suggestedDeliveryDays ? `For the current scope, I’d plan around ${client.suggestedDeliveryDays} days, subject to confirming the final deliverables.` : "I can confirm the delivery window after we lock the scope and dependencies.";
  if (intent === "proof") suggestedReply = matched.length ? `The most relevant areas from my profile are ${matched.join(", ")}. I can share the specific evidence that matches this requirement.` : "I’ll share the most relevant work evidence for this requirement rather than unrelated portfolio items.";
  if (intent === "meeting") suggestedReply = "A short call can work. Please share the agenda and a couple of suitable time options; I’ll confirm availability.";
  if (intent === "scope") suggestedReply = `My understanding is that the priority is ${opportunity.title}. I’d first confirm the acceptance criteria, current setup, and highest-priority workflow before implementation.`;

  return {
    intent,
    summary: `Prepared a non-binding reply for ${intent} intent.`,
    suggestedReply,
    requiresUserApproval: true,
    escalateToFinalApproval: false,
    reasons,
  };
}
