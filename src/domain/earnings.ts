export interface EarningsRecord {
  id: string;
  clientId?: string;
  applicationId?: string;
  projectTitle: string;
  amount: number;
  currency: string;
  receivedAt: string;
  notes?: string;
}

export interface EarningsSummary {
  totalReceived: number;
  byCurrency: Record<string, number>;
  payments: number;
}

export class InMemoryEarningsStore {
  private readonly records = new Map<string, EarningsRecord>();
  add(record: EarningsRecord): void { if (!Number.isFinite(record.amount) || record.amount <= 0) throw new Error("Earnings amount must be greater than zero"); this.records.set(record.id, structuredClone(record)); }
  list(): EarningsRecord[] { return [...this.records.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((v) => structuredClone(v)); }
  summary(): EarningsSummary { const byCurrency: Record<string, number> = {}; for (const item of this.records.values()) byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount; return { totalReceived: Object.values(byCurrency).reduce((a, b) => a + b, 0), byCurrency, payments: this.records.size }; }
}
