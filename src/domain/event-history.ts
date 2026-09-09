export type HistoryEventType =
  | "radar_run"
  | "opportunity_discovered"
  | "opportunity_scored"
  | "approval_created"
  | "approval_decided"
  | "client_stage_changed"
  | "message_received"
  | "reply_prepared"
  | "deal_reviewed"
  | "alert_created"
  | "scheduler_run"
  | "system_error"
  | "outcome_recorded";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: string;
  entityType: string;
  entityId: string;
  source?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  requiresUserApproval?: boolean;
}

export interface HistoryEventFilter {
  type?: HistoryEventType;
  entityType?: string;
  entityId?: string;
  source?: string;
  since?: string;
  until?: string;
}

export interface EventHistoryPort {
  append(event: HistoryEvent): Promise<void>;
  list(filter?: HistoryEventFilter): Promise<HistoryEvent[]>;
}

export class InMemoryEventHistory implements EventHistoryPort {
  private readonly events = new Map<string, HistoryEvent>();

  async append(event: HistoryEvent): Promise<void> {
    if (!this.events.has(event.id)) this.events.set(event.id, { ...event });
  }

  async list(filter: HistoryEventFilter = {}): Promise<HistoryEvent[]> {
    return [...this.events.values()]
      .filter((event) => !filter.type || event.type === filter.type)
      .filter((event) => !filter.entityType || event.entityType === filter.entityType)
      .filter((event) => !filter.entityId || event.entityId === filter.entityId)
      .filter((event) => !filter.source || event.source === filter.source)
      .filter((event) => !filter.since || event.timestamp >= filter.since)
      .filter((event) => !filter.until || event.timestamp <= filter.until)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

export function createHistoryEvent(input: Omit<HistoryEvent, "id"> & { id?: string }): HistoryEvent {
  const id = input.id ?? `${input.type}:${input.entityType}:${input.entityId}:${input.timestamp}`;
  return { ...input, id };
}
