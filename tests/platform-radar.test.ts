import { describe, expect, it } from "vitest";
import { createBrowserOpportunitySource, sessionSummary } from "../src/domain/platform.js";
import { defaultPlatformConnectors } from "../src/integrations/platforms.js";

const page = {
  url: "https://www.upwork.com/nx/find-work/",
  title: "Find Work",
  text: "React TypeScript developer jobs available now",
  links: [
    { text: "React TypeScript developer", href: "https://www.upwork.com/jobs/~01abc" },
    { text: "Marketing project", href: "https://www.upwork.com/jobs/~02def" },
    { text: "Not a job", href: "https://www.upwork.com/other" },
  ],
};

describe("personal platform radar", () => {
  it("extracts only supported opportunity links from a platform page", async () => {
    const source = createBrowserOpportunitySource(defaultPlatformConnectors);
    const opportunities = await source.discoverFromPages([page]);
    expect(opportunities).toHaveLength(2);
    expect(opportunities.map((item) => item.sourceUrl)).toContain("https://www.upwork.com/jobs/~01abc");
    expect(opportunities[0]?.source).toBe("upwork");
  });

  it("ignores pages from unsupported hosts", async () => {
    const source = createBrowserOpportunitySource(defaultPlatformConnectors);
    const opportunities = await source.discoverFromPages([{ ...page, url: "https://example.com/jobs" }]);
    expect(opportunities).toEqual([]);
  });

  it("summarizes connected sessions without exposing credentials", () => {
    expect(sessionSummary([
      { platform: "upwork", loggedIn: true, checkedAt: "2026-09-08T00:00:00.000Z" },
      { platform: "fiverr", loggedIn: false, checkedAt: "2026-09-08T00:00:00.000Z" },
    ])).toBe("Connected platforms: upwork");
  });
});
