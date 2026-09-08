import { buildAlerts, buildSystemErrorAlert, type Alert } from "../domain/alerts.js";
import { buildCommandCenterSnapshot, type CommandCenterSnapshot } from "./command-center.js";
import { LocalRadarScheduler, type SchedulerRunResult, type SchedulerState } from "../domain/scheduler.js";
import type { EventHistoryPort } from "../domain/event-history.js";
import { recordAutomationRun, recordSchedulerRun } from "./history-service.js";
import type { ApprovalRequest } from "../domain/approval.js";
import type { ClientRecord } from "../domain/client.js";
import type { RankedOpportunity } from "../domain/rank.js";

export interface AutomationRunInput {
  clients: readonly ClientRecord[];
  opportunities: readonly RankedOpportunity[];
  approvals?: readonly ApprovalRequest[] | undefined;
}

export interface AutomationSnapshot extends CommandCenterSnapshot {
  alerts: Alert[];
  run: SchedulerRunResult;
}

export interface AutomationOrchestratorOptions {
  intervalMs: number;
  discover: () => Promise<AutomationRunInput>;
  onSnapshot?: ((snapshot: AutomationSnapshot) => void | Promise<void>) | undefined;
  history?: EventHistoryPort | undefined;
  now?: (() => string) | undefined;
}

export class RadarAutomationOrchestrator {
  private latest?: AutomationSnapshot | undefined;
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
          const base: CommandCenterSnapshot & { alerts?: Alert[] | undefined } = this.latest ?? {
            actions: [], pendingApprovals: 0, activeClients: 0, qualifiedOpportunities: 0, dueFollowUps: 0,
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
        if (options.history && this.latest) {
          await recordAutomationRun(options.history, this.latest);
        }
        if (options.history) {
          await recordSchedulerRun(options.history, run);
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
