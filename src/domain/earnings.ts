export interface EarningsRecord {
  id: string;
  clientId?: string | undefined;
  applicationId?: string | undefined;
  projectTitle: string;
  amount: number;
  currency: string;
  receivedAt: string;
  notes?: string | undefined;
}

export interface EarningsSummary {
  totalReceived: number | null;
  byCurrency: Record<string, number>;
  payments: number;
}

export class InMemoryEarningsStore {
  private readonly records = new Map<string, EarningsRecord>();
  add(record: EarningsRecord): void { if (!Number.isFinite(record.amount) || record.amount <= 0) throw new Error("Earnings amount must be greater than zero"); this.records.set(record.id, structuredClone(record)); }
  list(): EarningsRecord[] { return [...this.records.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((v) => structuredClone(v)); }
  summary(): EarningsSummary { const byCurrency: Record<string, number> = {}; for (const item of this.records.values()) byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount; const currencies = Object.keys(byCurrency); return { totalReceived: currencies.length === 1 ? byCurrency[currencies[0]!]! : currencies.length === 0 ? 0 : null, byCurrency, payments: this.records.size }; }
}
