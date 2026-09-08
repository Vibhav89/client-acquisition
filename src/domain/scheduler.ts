export interface SchedulerState {
  running: boolean;
  lastStartedAt?: string | undefined;
  lastFinishedAt?: string | undefined;
  lastError?: string | undefined;
  runCount: number;
}

export interface SchedulerRunResult {
  startedAt: string;
  finishedAt: string;
  skipped: boolean;
  error?: string | undefined;
}

export interface RadarSchedulerOptions {
  intervalMs: number;
  now?: (() => string) | undefined;
  onRun: () => Promise<void>;
  onResult?: ((result: SchedulerRunResult) => void | Promise<void>) | undefined;
}

export class LocalRadarScheduler {
  private timer?: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private state: SchedulerState = { running: false, runCount: 0 };

  constructor(private readonly options: RadarSchedulerOptions) {
    if (!Number.isFinite(options.intervalMs) || options.intervalMs < 60_000) {
      throw new Error("Scheduler interval must be at least 60 seconds");
    }
  }

  getState(): SchedulerState {
    return { ...this.state };
  }

  async runNow(): Promise<SchedulerRunResult> {
    if (this.running) {
      const now = this.options.now?.() ?? new Date().toISOString();
      const result: SchedulerRunResult = { startedAt: now, finishedAt: now, skipped: true };
      await this.options.onResult?.(result);
      return result;
    }

    const startedAt = this.options.now?.() ?? new Date().toISOString();
    this.running = true;
    this.state = { ...this.state, running: true, lastStartedAt: startedAt, lastError: undefined };

    let result: SchedulerRunResult;
    try {
      await this.options.onRun();
      const finishedAt = this.options.now?.() ?? new Date().toISOString();
      result = { startedAt, finishedAt, skipped: false };
      this.state = { ...this.state, running: false, lastFinishedAt: finishedAt, runCount: this.state.runCount + 1 };
    } catch (error) {
      const finishedAt = this.options.now?.() ?? new Date().toISOString();
      const message = error instanceof Error ? error.message : "Unknown scheduler error";
      result = { startedAt, finishedAt, skipped: false, error: message };
      this.state = { ...this.state, running: false, lastFinishedAt: finishedAt, lastError: message, runCount: this.state.runCount + 1 };
    } finally {
      this.running = false;
    }

    await this.options.onResult?.(result);
    return result;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runNow(), this.options.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
