import { describe, expect, it } from "vitest";
import { RemoteOkSource, type FetchLike } from "../src/integrations/remoteok-source.js";

describe("RemoteOkSource", () => {
  it("normalizes Remote OK JSON into raw opportunities", async () => {
    const fetcher: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { legal: "terms" },
        {
          id: "123",
          url: "https://remoteok.com/remote-jobs/123",
          position: "Senior React Engineer",
          company: "Example Labs",
          description: "<p>Build <strong>React</strong> applications.</p>",
          tags: ["react", "typescript"],
          location: "Worldwide",
        },
      ],
    });

    const jobs = await new RemoteOkSource(fetcher).fetch();
    expect(jobs).toEqual([
      {
        id: "remoteok:123",
        source: "remoteok",
        url: "https://remoteok.com/remote-jobs/123",
        title: "Senior React Engineer — Example Labs",
        description: "Build React applications.",
        skills: ["react", "typescript"],
        location: "Worldwide",
        workMode: "remote",
      },
    ]);
  });

  it("fails closed on HTTP errors and malformed payloads", async () => {
    const failed: FetchLike = async () => ({ ok: false, status: 503, json: async () => [] });
    await expect(new RemoteOkSource(failed).fetch()).rejects.toThrow("503");

    const malformed: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}) });
    await expect(new RemoteOkSource(malformed).fetch()).rejects.toThrow("invalid payload");
  });
});
