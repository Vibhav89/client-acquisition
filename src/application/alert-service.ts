import { buildAlerts, buildSystemErrorAlert, type Alert, type AlertPolicy } from "../domain/alerts.js";
import type { CommandCenterSnapshot } from "./command-center.js";

export interface AlertSink {
  publish(alerts: readonly Alert[]): void | Promise<void>;
}

export class InMemoryAlertSink implements AlertSink {
  private readonly alerts: Alert[] = [];

  publish(alerts: readonly Alert[]): void {
    this.alerts.push(...alerts);
  }

  list(): Alert[] {
    return [...this.alerts];
  }
}

export async function emitCommandCenterAlerts(snapshot: CommandCenterSnapshot, sink: AlertSink, policy?: Partial<AlertPolicy>): Promise<Alert[]> {
  const alerts = buildAlerts(snapshot.actions, policy, snapshot.generatedAt);
  if (alerts.length) await sink.publish(alerts);
  return alerts;
}

export async function emitSchedulerErrorAlert(sink: AlertSink, message: string, now = new Date().toISOString()): Promise<Alert> {
  const alert = buildSystemErrorAlert(message, now);
  await sink.publish([alert]);
  return alert;
}
