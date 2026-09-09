import type { BrowserPage, PlatformConnector, PlatformDefinition } from "../domain/platform.js";
import type { Opportunity } from "../domain/opportunity.js";

const opportunityWords = /job|jobs|project|projects|gig|gigs|contract|freelance|hiring|work|task|tasks|developer|engineer|annotat|reviewer|designer|writer|assistant|tester/i;
const knownSkills = ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "Supabase", "AI", "LLM", "API", "Figma", "Data annotation", "Content review"];

function hostMatches(url: string, hosts: readonly string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function inferSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}

export function createGenericPlatformConnector(platform: PlatformDefinition): PlatformConnector {
  return {
    platform: platform.platform,
    displayName: platform.displayName,
    canHandle: (page) => hostMatches(page.url, platform.hosts),
    async extractOpportunities(page: BrowserPage): Promise<readonly Opportunity[]> {
      const links = (page.links ?? [])
        .filter((link) => opportunityWords.test(link.text))
        .filter((link) => hostMatches(link.href, platform.hosts))
        .filter((link) => link.text.trim().length >= 8 && link.text.trim().length <= 180);
      const unique = [...new Map(links.map((link) => [link.href.split("#")[0], link])).values()].slice(0, 50);
      return unique.map((link) => ({
        id: `${platform.platform}:${link.href.split("#")[0]}`,
        source: platform.platform,
        sourceUrl: link.href,
        title: link.text.trim(),
        description: page.text.slice(0, 4_000),
        skills: inferSkills(`${link.text}\n${page.text}`),
        workMode: "remote",
        status: "new",
        discoveredAt: new Date().toISOString(),
      }));
    },
  };
}
