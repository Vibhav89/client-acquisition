import { buildAlerts, buildSystemErrorAlert, type Alert } from "../domain/alerts.js";
import { buildCommandCenterSnapshot, type CommandCenterSnapshot } from "./command-center.js";
import { LocalRadarScheduler, type SchedulerRunResult, type SchedulerState } from "../domain/scheduler.js";
import type { ApprovalRequest } from "../domain/approval.js";
import type { ClientRecord } from "../domain/client.js";
import type { RankedOpportunity } from "../domain/rank.js";

export interface AutomationRunInput {
  clients: readonly ClientRecord[];
  opportunities: readonly RankedOpportunity[];
  approvals?: readonly ApprovalRequest[];
}

export interface AutomationSnapshot extends CommandCenterSnapshot {
  alerts: Alert[];
  run: SchedulerRunResult;
}

export interface AutomationOrchestratorOptions {
  intervalMs: number;
  discover: () => Promise<AutomationRunInput>;
  onSnapshot?: (snapshot: AutomationSnapshot) => void | Promise<void>;
  now?: () => string;
}

export class RadarAutomationOrchestrator {
  private latest?: AutomationSnapshot;
  private readonly scheduler: LocalRadarScheduler;
  private readonly options: AutomationOrchestratorOptions;

  constructor(options: AutomationOrchestratorOptions) {
    this.options = options;
    this.scheduler = new LocalRadarScheduler({
      intervalMs: options.intervalMs,
      now: options.now,
      onRun: async () => {
        const input = await options.discover();
        const generatedAt = options.now?.() ?? new Date().toISOString();
        const commandCenter = buildCommandCenterSnapshot({ ...input, scheduler: this.scheduler.getState(), now: generatedAt });
        const alerts = buildAlerts(commandCenter.actions, {}, generatedAt);
        this.latest = {
          ...commandCenter,
          alerts,
          run: { startedAt: generatedAt, finishedAt: generatedAt, skipped: false },
        };
      },
      onResult: async (run) => {
        const generatedAt = options.now?.() ?? new Date().toISOString();
        if (run.error) {
          const base = this.latest ?? {
            actions: [], pendingApprovals: 0, activeClients: 0, qualifiedOpportunities: 0,
            generatedAt,
          };
          this.latest = {
            ...base,
            scheduler: this.scheduler.getState(),
            alerts: [...(base.alerts ?? []), buildSystemErrorAlert(run.error, generatedAt)],
            run,
            generatedAt,
          };
        } else if (this.latest) {
          this.latest = { ...this.latest, scheduler: this.scheduler.getState(), run };
        }
        if (this.latest) await options.onSnapshot?.(this.latest);
      },
    });
  }

  getState(): SchedulerState { return this.scheduler.getState(); }
  getLatest(): AutomationSnapshot | undefined { return this.latest ? { ...this.latest, actions: [...this.latest.actions], alerts: [...this.latest.alerts] } : undefined; }
  async runNow(): Promise<SchedulerRunResult> { return this.scheduler.runNow(); }
  start(): void { this.scheduler.start(); }
  stop(): void { this.scheduler.stop(); }
}
