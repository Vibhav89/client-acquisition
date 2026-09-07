import type { RawOpportunity } from "../domain/normalizer.js";

export interface FetchLike {
  (input: string, init?: { headers?: Record<string, string> }): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
}

interface RemoteOkJob {
  id?: string;
  url?: string;
  apply_url?: string;
  position?: string;
  company?: string;
  description?: string;
  tags?: unknown;
  location?: string;
}

const DEFAULT_URL = "https://remoteok.com/api";

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class RemoteOkSource {
  readonly name = "remoteok";

  constructor(
    private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis),
    private readonly endpoint = DEFAULT_URL,
  ) {}

  async fetch(): Promise<RawOpportunity[]> {
    const response = await this.fetcher(this.endpoint, {
      headers: { accept: "application/json", "user-agent": "client-acquisition/0.1" },
    });
    if (!response.ok) throw new Error(`Remote OK request failed: ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("Remote OK returned an invalid payload");

    return payload
      .filter((item): item is RemoteOkJob => typeof item === "object" && item !== null && !("legal" in item))
      .filter((job) => typeof job.url === "string" || typeof job.apply_url === "string")
      .map((job) => {
        const url = typeof job.url === "string" ? job.url : job.apply_url as string;
        const tags = Array.isArray(job.tags) ? job.tags.filter((tag): tag is string => typeof tag === "string") : [];
        const title = typeof job.position === "string" ? job.position : "Remote opportunity";
        const company = typeof job.company === "string" ? job.company.trim() : "";
        const description = typeof job.description === "string" ? stripHtml(job.description) : "";
        return {
          id: job.id ? `remoteok:${job.id}` : `remoteok:${url}`,
          source: this.name,
          url,
          title: company ? `${title} — ${company}` : title,
          description,
          skills: tags,
          location: typeof job.location === "string" ? job.location.trim() : undefined,
          workMode: "remote",
        };
      });
  }
}
