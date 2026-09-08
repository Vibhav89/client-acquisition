import type { ActionItem } from "./action-queue.js";

export type AlertSeverity = "critical" | "high" | "normal";
export type AlertType = "approval_required" | "client_reply" | "deal_review" | "strong_opportunity" | "system_error";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionId?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface AlertPolicy {
  minimumPriority: number;
  maxAlerts: number;
}

const DEFAULT_POLICY: AlertPolicy = { minimumPriority: 70, maxAlerts: 10 };

export function buildAlerts(actions: readonly ActionItem[], policy: Partial<AlertPolicy> = {}, now = new Date().toISOString()): Alert[] {
  const resolved = { ...DEFAULT_POLICY, ...policy };
  return actions
    .filter((action) => action.priority >= resolved.minimumPriority)
    .slice(0, resolved.maxAlerts)
    .map((action) => {
      const type: AlertType = action.type === "approval" ? "approval_required"
        : action.type === "reply" ? "client_reply"
        : action.type === "deal_review" ? "deal_review"
        : "strong_opportunity";
      const severity: AlertSeverity = action.priority >= 100 ? "critical" : action.priority >= 85 ? "high" : "normal";
      return {
        id: `alert:${action.id}`,
        type,
        severity,
        title: action.title,
        message: action.summary,
        actionId: action.id,
        sourceUrl: action.sourceUrl,
        createdAt: now,
      };
    });
}

export function buildSystemErrorAlert(message: string, now = new Date().toISOString()): Alert {
  return {
    id: `alert:system:${now}`,
    type: "system_error",
    severity: "high",
    title: "Radar needs attention",
    message,
    createdAt: now,
  };
}
