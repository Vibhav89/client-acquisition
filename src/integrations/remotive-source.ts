import type { RawOpportunity } from "../domain/normalizer.js";
import type { FetchLike } from "./remoteok-source.js";
export type { FetchLike } from "./remoteok-source.js";

interface RemotiveJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  description?: string;
  tags?: unknown;
  candidate_required_location?: string;
  salary?: string;
  job_type?: string;
}

interface RemotivePayload {
  jobs?: unknown;
}

const DEFAULT_URL = "https://remotive.com/api/remote-jobs";

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class RemotiveSource {
  readonly name = "remotive";

  constructor(
    private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis),
    private readonly endpoint = DEFAULT_URL,
  ) {}

  async fetch(): Promise<RawOpportunity[]> {
    const response = await this.fetcher(this.endpoint, {
      headers: { accept: "application/json", "user-agent": "client-acquisition/0.1" },
    });
    if (!response.ok) throw new Error(`Remotive request failed: ${response.status}`);

    const payload = await response.json() as RemotivePayload;
    if (!payload || !Array.isArray(payload.jobs)) throw new Error("Remotive returned an invalid payload");

    return payload.jobs
      .filter((item): item is RemotiveJob => typeof item === "object" && item !== null)
      .filter((job) => typeof job.url === "string")
      .map((job) => ({
        ...(job.id === undefined ? {} : { id: `remotive:${job.id}` }),
        source: this.name,
        url: job.url as string,
        title: typeof job.title === "string" ? job.title : "Remote opportunity",
        description: typeof job.description === "string" ? stripHtml(job.description) : "",
        skills: Array.isArray(job.tags) ? job.tags.filter((tag): tag is string => typeof tag === "string") : [],
        ...(typeof job.candidate_required_location === "string" && job.candidate_required_location.trim()
          ? { location: job.candidate_required_location.trim() }
          : {}),
        workMode: "remote",
      }));
  }
}
