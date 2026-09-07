import { describe, expect, it } from "vitest";
import { normalizeOpportunity } from "../src/domain/normalizer.js";
import { deduplicateOpportunities } from "../src/domain/source.js";

describe("normalization and source handling", () => {
  it("normalizes optional fields without manufacturing values", () => {
    const result = normalizeOpportunity({
      source: "test",
      url: "https://example.com/a",
      title: "  React developer  ",
      skills: ["React", " React ", "TypeScript"],
      workMode: "fully remote",
    }, "2026-09-07T00:00:00Z");

    expect(result.title).toBe("React developer");
    expect(result.skills).toEqual(["React", "TypeScript"]);
    expect(result.workMode).toBe("remote");
    expect(result.budget).toBeUndefined();
  });

  it("rejects invalid URLs", () => {
    expect(() => normalizeOpportunity({ source: "test", url: "example.com/job" })).toThrow("url must be absolute");
  });

  it("deduplicates by source and canonical URL", () => {
    const a = normalizeOpportunity({ source: "X", url: "https://example.com/a" });
    const b = normalizeOpportunity({ source: "X", url: "https://example.com/a" });
    const c = normalizeOpportunity({ source: "Y", url: "https://example.com/a" });
    expect(deduplicateOpportunities([a, b, c])).toHaveLength(2);
  });
});
