import type { ClientEvent, ClientRecord, ClientStage, ConversationMessage } from "../domain/client.js";

export interface ClientCrmPort {
  upsertClient(client: ClientRecord): void | Promise<void>;
  getClient(id: string): ClientRecord | undefined | Promise<ClientRecord | undefined>;
  listClients(): ClientRecord[] | Promise<ClientRecord[]>;
  addMessage(message: ConversationMessage): void | Promise<void>;
  listMessages(clientId: string): ConversationMessage[] | Promise<ConversationMessage[]>;
  addEvent(event: ClientEvent): void | Promise<void>;
  listEvents(clientId: string): ClientEvent[] | Promise<ClientEvent[]>;
}

export class InMemoryClientCrm implements ClientCrmPort {
  private readonly clients = new Map<string, ClientRecord>();
  private readonly messages: ConversationMessage[] = [];
  private readonly events: ClientEvent[] = [];

  upsertClient(client: ClientRecord): void { this.clients.set(client.id, client); }
  getClient(id: string): ClientRecord | undefined { return this.clients.get(id); }
  listClients(): ClientRecord[] { return [...this.clients.values()].sort((a, b) => b.priorityScore - a.priorityScore); }
  addMessage(message: ConversationMessage): void { this.messages.push(message); }
  listMessages(clientId: string): ConversationMessage[] { return this.messages.filter((item) => item.clientId === clientId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)); }
  addEvent(event: ClientEvent): void { this.events.push(event); }
  listEvents(clientId: string): ClientEvent[] { return this.events.filter((item) => item.clientId === clientId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
}

const allowedTransitions: Record<ClientStage, readonly ClientStage[]> = {
  discovered: ["qualified", "lost"],
  qualified: ["approached", "lost"],
  approached: ["replied", "lost"],
  replied: ["conversation", "lost"],
  conversation: ["negotiation", "interested", "lost"],
  negotiation: ["interested", "lost"],
  interested: ["final_approval", "lost"],
  final_approval: ["won", "lost"],
  won: ["work", "lost"],
  lost: [],
  work: ["payment"],
  payment: ["review"],
  review: [],
};

export async function transitionClientStage(crm: ClientCrmPort, clientId: string, toStage: ClientStage, summary: string, now = new Date().toISOString()): Promise<ClientRecord> {
  const current = await crm.getClient(clientId);
  if (!current) throw new Error(`Client not found: ${clientId}`);
  if (!allowedTransitions[current.stage].includes(toStage)) throw new Error(`Invalid client transition: ${current.stage} -> ${toStage}`);
  const next: ClientRecord = { ...current, stage: toStage, updatedAt: now };
  await crm.upsertClient(next);
  await crm.addEvent({ id: `event:${clientId}:${now}:${toStage}`, clientId, type: "stage_changed", fromStage: current.stage, toStage, summary, createdAt: now });
  return next;
}
