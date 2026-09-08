import type { Opportunity } from "./opportunity.js";

export type PlatformName = "linkedin" | "upwork" | "fiverr" | "outlier" | "generic";

export interface BrowserLink {
  readonly text: string;
  readonly href: string;
}

export interface BrowserPage {
  readonly url: string;
  readonly title?: string;
  readonly text: string;
  readonly links?: readonly BrowserLink[];
}

export interface PlatformSession {
  readonly platform: PlatformName;
  readonly loggedIn: boolean;
  readonly checkedAt: string;
  readonly profileUrl?: string;
}

export interface PlatformConnector {
  readonly platform: PlatformName;
  readonly displayName: string;
  canHandle(page: BrowserPage): boolean;
  extractOpportunities(page: BrowserPage): Promise<readonly Opportunity[]>;
}

export interface BrowserOpportunitySource {
  readonly name: string;
  discoverFromPages(pages: readonly BrowserPage[]): Promise<readonly Opportunity[]>;
}

export function createBrowserOpportunitySource(
  connectors: readonly PlatformConnector[],
): BrowserOpportunitySource {
  return {
    name: "logged-in-browser",
    async discoverFromPages(pages) {
      const results: Opportunity[] = [];
      for (const page of pages) {
        const connector = connectors.find((candidate) => candidate.canHandle(page));
        if (!connector) continue;
        try {
          results.push(...await connector.extractOpportunities(page));
        } catch {
          // One platform/page failure must not stop the radar.
        }
      }
      return results;
    },
  };
}

export function sessionSummary(sessions: readonly PlatformSession[]): string {
  const connected = sessions.filter((session) => session.loggedIn).map((session) => session.platform);
  return connected.length === 0 ? "No platform sessions detected." : `Connected platforms: ${connected.join(", ")}`;
}
