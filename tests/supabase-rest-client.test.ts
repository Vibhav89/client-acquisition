import { describe, expect, it } from "vitest";
import { getSupabaseAuthUser, SupabaseRestClient } from "../src/integrations/supabase-rest-client.js";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Supabase REST client", () => {
  it("validates a bearer token through Supabase Auth", async () => {
    const calls: string[] = [];
    const fetchMock: typeof fetch = async (input) => {
      calls.push(String(input));
      return response(200, { id: "user-123", email: "user@example.com" });
    };
    await expect(getSupabaseAuthUser("https://example.supabase.co", "anon", "token", fetchMock))
      .resolves.toEqual({ id: "user-123", email: "user@example.com" });
    expect(calls[0]).toContain("/auth/v1/user");
  });

  it("builds authenticated filtered PostgREST requests", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchMock: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return response(200, [{ id: "1" }]);
    };
    const client = new SupabaseRestClient("https://example.supabase.co", "anon", "token", fetchMock);
    const result = await client.from("opportunities").select("*").eq("id", "1").eq("user_id", "user-123");
    expect(result.data).toEqual([{ id: "1" }]);
    expect(requestUrl).toContain("id=eq.1");
    expect(requestUrl).toContain("user_id=eq.user-123");
    expect(requestUrl).toContain("select=*");
    expect((requestInit?.headers as Record<string, string>).authorization).toBe("Bearer token");
    expect((requestInit?.headers as Record<string, string>).apikey).toBe("anon");
  });

  it("returns undefined for invalid auth", async () => {
    const fetchMock: typeof fetch = async () => response(401, { error: "invalid token" });
    await expect(getSupabaseAuthUser("https://example.supabase.co", "anon", "bad", fetchMock)).resolves.toBeUndefined();
  });
});
