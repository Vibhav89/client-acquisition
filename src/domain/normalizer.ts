import type { Opportunity, WorkMode } from "./opportunity.js";

export interface RawOpportunity {
  id?: string;
  source: string;
  url: string;
  title?: string;
  description?: string;
  skills?: string[];
  location?: string;
  workMode?: string;
  currency?: string;
  min?: number;
  max?: number;
  unit?: "hour" | "fixed" | "unknown";
}

function workMode(value?: string): WorkMode {
  const normalized = value?.toLowerCase().trim();
  if (normalized?.includes("remote")) return "remote";
  if (normalized?.includes("hybrid")) return "hybrid";
  if (normalized?.includes("onsite") || normalized?.includes("on-site")) return "onsite";
  return "unknown";
}

export function normalizeOpportunity(raw: RawOpportunity, discoveredAt = new Date().toISOString()): Opportunity {
  if (!raw.source.trim()) throw new Error("source is required");
  if (!raw.url.startsWith("https://") && !raw.url.startsWith("http://")) throw new Error("url must be absolute");

  const skills = [...new Set((raw.skills ?? []).map((skill) => skill.trim()).filter(Boolean))];
  const budget = raw.currency || raw.min !== undefined || raw.max !== undefined
    ? { currency: raw.currency ?? "UNKNOWN", min: raw.min, max: raw.max, unit: raw.unit ?? "unknown" }
    : undefined;

  return {
    id: raw.id?.trim() || `${raw.source}:${raw.url}`,
    source: raw.source.trim(),
    sourceUrl: raw.url,
    title: raw.title?.trim() || "Untitled opportunity",
    description: raw.description?.trim() || "",
    skills,
    workMode: workMode(raw.workMode),
    ...(raw.location ? { location: raw.location.trim() } : {}),
    ...(budget ? { budget } : {}),
    status: "new",
    discoveredAt,
  };
}
