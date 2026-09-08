import type { BrowserPage, PlatformConnector, PlatformName } from "../domain/platform.js";
import type { Opportunity } from "../domain/opportunity.js";

const platformHosts: Record<Exclude<PlatformName, "generic">, string[]> = {
  linkedin: ["linkedin.com"],
  upwork: ["upwork.com"],
  fiverr: ["fiverr.com"],
  outlier: ["outlier.ai", "outlier.com"],
};

const opportunityWords = /job|jobs|project|projects|gig|gigs|contract|freelance|hiring|work|task|tasks|developer|engineer|annotat|reviewer/i;

function hostMatches(url: string, hosts: readonly string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function inferSkills(text: string): string[] {
  const known = ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "Supabase", "AI", "LLM", "API", "Figma", "Data annotation", "Content review"];
  const lower = text.toLowerCase();
  return known.filter((skill) => lower.includes(skill.toLowerCase()));
}

function genericExtract(platform: PlatformName, page: BrowserPage): Opportunity[] {
  const lines = page.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const titleCandidates = lines.filter((line) => line.length >= 8 && line.length <= 180 && opportunityWords.test(line));
  const uniqueTitles = [...new Set(titleCandidates)].slice(0, 25);
  return uniqueTitles.map((title, index) => ({
    id: `${platform}:${Buffer.from(`${page.url}#${index}`).toString("base64url")}`,
    source: platform,
    sourceUrl: page.url,
    title,
    description: page.text.slice(0, 4_000),
    skills: inferSkills(`${title}\n${page.text}`),
    workMode: "remote",
    status: "new",
    discoveredAt: new Date().toISOString(),
  }));
}

function connector(platform: Exclude<PlatformName, "generic">, displayName: string): PlatformConnector {
  return {
    platform,
    displayName,
    canHandle: (page) => hostMatches(page.url, platformHosts[platform]),
    async extractOpportunities(page) {
      return genericExtract(platform, page);
    },
  };
}

export const defaultPlatformConnectors: readonly PlatformConnector[] = [
  connector("linkedin", "LinkedIn"),
  connector("upwork", "Upwork"),
  connector("fiverr", "Fiverr"),
  connector("outlier", "Outlier"),
];
