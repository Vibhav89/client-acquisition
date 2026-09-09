import type { EventHistoryPort, HistoryEvent, HistoryEventFilter } from "../domain/event-history.js";

interface HistoryQueryBuilder extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  eq(column: string, value: string): HistoryQueryBuilder;
  gte(column: string, value: string): HistoryQueryBuilder;
  lte(column: string, value: string): HistoryQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

export interface SupabaseHistoryClientLike {
  from(table: string): {
    upsert(value: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: { message: string } | null }>;
    select(columns?: string): HistoryQueryBuilder;
  };
}

function toRow(event: HistoryEvent, userId: string): Record<string, unknown> {
  return {
    id: event.id,
    user_id: userId,
    type: event.type,
    timestamp: event.timestamp,
    entity_type: event.entityType,
    entity_id: event.entityId,
    ...(event.source === undefined ? {} : { source: event.source }),
    summary: event.summary,
    ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
    requires_user_approval: event.requiresUserApproval ?? false,
  };
}

function fromRow(row: Record<string, unknown>): HistoryEvent {
  return {
    id: String(row.id),
    type: row.type as HistoryEvent["type"],
    timestamp: String(row.timestamp),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    ...(typeof row.source === "string" ? { source: row.source } : {}),
    summary: String(row.summary),
    ...(row.metadata && typeof row.metadata === "object" ? { metadata: row.metadata as Record<string, unknown> } : {}),
    ...(row.requires_user_approval === true ? { requiresUserApproval: true } : {}),
  };
}

export class SupabaseEventHistory implements EventHistoryPort {
  constructor(private readonly client: SupabaseHistoryClientLike, private readonly userId: string) {}

  async append(event: HistoryEvent): Promise<void> {
    const { error } = await this.client.from("event_history").upsert(toRow(event, this.userId), { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save history event: ${error.message}`);
  }

  async list(filter: HistoryEventFilter = {}): Promise<HistoryEvent[]> {
    let query = this.client.from("event_history").select("*").eq("user_id", this.userId);
    if (filter.type) query = query.eq("type", filter.type);
    if (filter.entityType) query = query.eq("entity_type", filter.entityType);
    if (filter.entityId) query = query.eq("entity_id", filter.entityId);
    if (filter.source) query = query.eq("source", filter.source);
    if (filter.since) query = query.gte("timestamp", filter.since);
    if (filter.until) query = query.lte("timestamp", filter.until);
    const { data, error } = await query.order("timestamp", { ascending: true });
    if (error) throw new Error(`Failed to list history events: ${error.message}`);
    return (data ?? []).map((row) => fromRow(row as Record<string, unknown>));
  }
}
