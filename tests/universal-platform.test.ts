import { afterEach, describe, expect, it } from "vitest";
import { getPlatformDefinitions } from "../src/integrations/platform-config.js";
import { createGenericPlatformConnector } from "../src/integrations/generic-platform-connector.js";

const originalCustomPlatforms = process.env.CLIENT_RADAR_CUSTOM_PLATFORMS;

afterEach(() => {
  if (originalCustomPlatforms === undefined) delete process.env.CLIENT_RADAR_CUSTOM_PLATFORMS;
  else process.env.CLIENT_RADAR_CUSTOM_PLATFORMS = originalCustomPlatforms;
});

describe("universal platform registry", () => {
  it("registers a new platform from configuration without changing core platform types", () => {
    process.env.CLIENT_RADAR_CUSTOM_PLATFORMS = JSON.stringify([
      {
        id: "freelancer",
        displayName: "Freelancer",
        hosts: ["freelancer.com"],
        startUrl: "https://www.freelancer.com/jobs/",
      },
    ]);

    const definition = getPlatformDefinitions().find((item) => item.platform === "freelancer");
    expect(definition).toMatchObject({
      platform: "freelancer",
      displayName: "Freelancer",
      hosts: ["freelancer.com"],
    });
  });

  it("uses the generic connector for a custom platform", async () => {
    const definition = {
      platform: "custom-board",
      displayName: "Custom Board",
      hosts: ["jobs.example.com"],
      startUrl: "https://jobs.example.com/search",
      envDirectory: "custom-board",
    } as const;

    const connector = createGenericPlatformConnector(definition);
    expect(connector.canHandle({ url: "https://jobs.example.com/search", text: "" })).toBe(true);

    const opportunities = await connector.extractOpportunities({
      url: definition.startUrl,
      text: "Remote TypeScript developer projects",
      links: [
        { text: "Build a TypeScript dashboard project", href: "https://jobs.example.com/jobs/123" },
        { text: "Company homepage", href: "https://jobs.example.com/about" },
      ],
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      source: "custom-board",
      sourceUrl: "https://jobs.example.com/jobs/123",
      title: "Build a TypeScript dashboard project",
      skills: expect.arrayContaining(["TypeScript"]),
    });
  });

  it("rejects unsafe custom platform URLs", () => {
    process.env.CLIENT_RADAR_CUSTOM_PLATFORMS = JSON.stringify([
      {
        id: "unsafe",
        displayName: "Unsafe",
        hosts: ["example.com"],
        startUrl: "javascript:alert(1)",
      },
    ]);

    expect(getPlatformDefinitions().some((item) => item.platform === "unsafe")).toBe(false);
  });
});
