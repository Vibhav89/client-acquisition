import { describe, expect, it } from "vitest";
import { adaptRawSource } from "../src/integrations/opportunity-source-adapter.js";

describe("adaptRawSource", () => {
  it("normalizes valid records and drops malformed records", async () => {
    const source = adaptRawSource({
      name: "fixture",
      async fetch() {
        return [
          {
            source: "fixture",
            url: "https://example.com/job/1",
            title: "TypeScript developer",
            description: "Build APIs",
            skills: ["TypeScript"],
            workMode: "remote",
          },
          {
            source: "fixture",
            url: "not-a-url",
            title: "bad",
            description: "bad",
            skills: [],
          },
        ];
      },
    });

    const opportunities = await source.discover();
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.source).toBe("fixture");
    expect(opportunities[0]?.status).toBe("new");
  });
});
