export type ClientStage =
  | "discovered"
  | "qualified"
  | "approached"
  | "replied"
  | "conversation"
  | "negotiation"
  | "interested"
  | "final_approval"
  | "won"
  | "lost"
  | "work"
  | "payment"
  | "review";

export interface ClientRecord {
  id: string;
  opportunityIds: string[];
  source: string;
  sourceUrl: string;
  name?: string | undefined;
  country?: string | undefined;
  verified?: boolean | undefined;
  hireRate?: number | undefined;
  totalSpent?: number | undefined;
  stage: ClientStage;
  fitScore: number;
  legitimacyScore: number;
  priorityScore: number;
  summary: string;
  needs: string[];
  objections: string[];
  approachAngle: string;
  suggestedPriceUsd?: number | undefined;
  suggestedDeliveryDays?: number | undefined;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  clientId: string;
  direction: "inbound" | "outbound";
  body: string;
  timestamp: string;
  channel?: string | undefined;
}

export interface ClientEvent {
  id: string;
  clientId: string;
  type: string;
  fromStage?: ClientStage | undefined;
  toStage?: ClientStage | undefined;
  summary: string;
  createdAt: string;
}

export interface ClientIntelligence {
  fitScore: number;
  legitimacyScore: number;
  priorityScore: number;
  needs: string[];
  objections: string[];
  approachAngle: string;
  suggestedPriceUsd?: number | undefined;
  suggestedDeliveryDays?: number | undefined;
  nextAction: string;
  reasoning: string[];
}
