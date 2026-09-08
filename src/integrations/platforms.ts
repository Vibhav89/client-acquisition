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

function extractLinkedOpportunities(platform: PlatformName, page: BrowserPage): Opportunity[] {
  const links = (page.links ?? [])
    .filter((link) => opportunityWords.test(link.text))
    .filter((link) => hostMatches(link.href, platformHosts[platform as Exclude<PlatformName, "generic">] ?? []))
    .filter((link) => /\/(jobs?|projects?|gigs?|tasks?|contracts?)\//i.test(link.href) || /\/~[a-z0-9]+/i.test(link.href))
    .filter((link) => link.text.length >= 8 && link.text.length <= 180);
  const unique = [...new Map(links.map((link) => [link.href.split("#")[0], link])).values()].slice(0, 50);

  return unique.map((link) => ({
    id: `${platform}:${link.href.split("#")[0]}`,
    source: platform,
    sourceUrl: link.href,
    title: link.text,
    description: page.text.slice(0, 4_000),
    skills: inferSkills(`${link.text}\n${page.text}`),
    workMode: "remote",
    status: "new",
    discoveredAt: new Date().toISOString(),
  }));
}

function connector(platform: Exclude<PlatformName, "generic">, displayName: string): PlatformConnector {
  return {
    platform,
    displayName,
    canHandle: (page) => hostMatches(page.url, platformHosts[platform] ?? []),
    async extractOpportunities(page) {
      return extractLinkedOpportunities(platform, page);
    },
  };
}

export const defaultPlatformConnectors: readonly PlatformConnector[] = [
  connector("linkedin", "LinkedIn"),
  connector("upwork", "Upwork"),
  connector("fiverr", "Fiverr"),
  connector("outlier", "Outlier"),
];
