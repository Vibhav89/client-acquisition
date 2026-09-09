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

const TECH_SKILL_KEYWORDS = [
  "TypeScript", "JavaScript", "React", "Node.js", "Python", "Golang", "Ruby", "Rails",
  "Java", "C++", "C#", "PHP", "DevOps", "QA", "Data", "AI", "LLM", "AWS", "Docker",
  "Kubernetes", "Supabase", "PostgreSQL", "SQL", "GraphQL", "CSS", "HTML", "Vue", "Angular",
  "Full-Stack", "Frontend", "Backend"
];

function extractSkills(rawSkills: string[] | undefined, title: string, description: string): string[] {
  const skillsSet = new Set((rawSkills ?? []).map((s) => s.trim()).filter(Boolean));
  const text = `${title} ${description}`.toLowerCase();
  for (const tech of TECH_SKILL_KEYWORDS) {
    const lower = tech.toLowerCase();
    if (text.includes(lower) || (lower.includes("-") && text.includes(lower.replace("-", " ")))) {
      skillsSet.add(tech);
    }
  }
  return [...skillsSet];
}

export function normalizeOpportunity(raw: RawOpportunity, discoveredAt = new Date().toISOString()): Opportunity {
  if (!raw.source.trim()) throw new Error("source is required");
  if (!raw.url.startsWith("https://") && !raw.url.startsWith("http://")) throw new Error("url must be absolute");

  const title = raw.title?.trim() || "Untitled opportunity";
  const description = raw.description?.trim() || "";
  const skills = extractSkills(raw.skills, title, description);
  const budget = raw.currency || raw.min !== undefined || raw.max !== undefined
    ? {
        currency: raw.currency ?? "UNKNOWN",
        ...(raw.min !== undefined ? { min: raw.min } : {}),
        ...(raw.max !== undefined ? { max: raw.max } : {}),
        unit: raw.unit ?? "unknown",
      }
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
