import { describe, expect, it } from "vitest";
import { RemotiveSource, type FetchLike } from "../src/integrations/remotive-source.js";

describe("RemotiveSource", () => {
  it("normalizes Remotive jobs", async () => {
    const fetcher: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        jobs: [{
          id: 42,
          url: "https://remotive.com/remote-jobs/software-dev/react-engineer-42",
          title: "React Engineer",
          company_name: "Example Labs",
          description: "<p>Build <strong>React</strong> products.</p>",
          tags: ["React", "TypeScript"],
          candidate_required_location: "Worldwide",
          job_type: "full_time",
        }],
      }),
    });

    const jobs = await new RemotiveSource(fetcher).fetch();
    expect(jobs).toEqual([{
      id: "remotive:42",
      source: "remotive",
      url: "https://remotive.com/remote-jobs/software-dev/react-engineer-42",
      title: "React Engineer",
      description: "Build React products.",
      skills: ["React", "TypeScript"],
      location: "Worldwide",
      workMode: "remote",
    }]);
  });

  it("fails closed on malformed responses", async () => {
    const malformed: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}) });
    await expect(new RemotiveSource(malformed).fetch()).rejects.toThrow("invalid payload");
  });
});
