import { describe, expect, it } from "vitest";
import { createPlatformRegistry } from "../src/domain/platform-registry.js";
import { createGenericPlatformConnector } from "../src/integrations/generic-platform-connector.js";

describe("platform registry", () => {
  it("accepts a new platform without changing the core platform type", async () => {
    const definition = {
      platform: "freelancer",
      displayName: "Freelancer",
      hosts: ["freelancer.com"],
      startUrl: "https://www.freelancer.com/jobs/",
      envDirectory: "freelancer",
    } as const;
    const connector = createGenericPlatformConnector(definition);
    const registry = createPlatformRegistry([definition], [connector]);

    expect(registry.getDefinition("freelancer")?.displayName).toBe("Freelancer");
    expect(registry.getConnector("freelancer")).toBe(connector);

    const opportunities = await connector.extractOpportunities({
      url: "https://www.freelancer.com/jobs/",
      text: "Freelancer jobs TypeScript React",
      links: [{ text: "React TypeScript Developer project", href: "https://www.freelancer.com/projects/react/react-typescript-developer" }],
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.source).toBe("freelancer");
    expect(opportunities[0]?.sourceUrl).toContain("freelancer.com/projects");
  });
});
