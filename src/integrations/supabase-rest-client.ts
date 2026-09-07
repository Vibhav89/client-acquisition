import type { SupabaseClientLike } from "./supabase-repository.js";

type FetchLike = typeof fetch;

interface RestResponse {
  data: unknown[] | null;
  error: { message: string } | null;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export class SupabaseRestClient implements SupabaseClientLike {
  constructor(
    private readonly baseUrl: string,
    private readonly anonKey: string,
    private readonly accessToken: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  from(table: string) {
    const state: { filters: Array<[string, string]> } = { filters: [] };
    const url = () => {
      const query = state.filters.map(([column, value]) => `${encode(column)}=eq.${encode(value)}`).join("&");
      return `${this.baseUrl.replace(/\/$/, "")}/rest/v1/${encode(table)}${query ? `?${query}` : ""}`;
    };
    const headers = {
      apikey: this.anonKey,
      authorization: `Bearer ${this.accessToken}`,
      "content-type": "application/json",
    };

    return {
      upsert: async (values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) => {
        const target = options?.onConflict ? `?on_conflict=${encode(options.onConflict)}` : "";
        const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/${encode(table)}${target}`, {
          method: "POST",
          headers: { ...headers, prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(values),
        });
        return { error: response.ok ? null : { message: await response.text() } };
      },
      select: (columns = "*") => {
        const builder = {
          eq: (column: string, value: string) => {
            state.filters.push([column, value]);
            return builder;
          },
          order: async (column: string, options?: { ascending?: boolean }): Promise<RestResponse> => {
            const separator = state.filters.length ? "&" : "?";
            const order = `${encode(column)}.${options?.ascending === false ? "desc" : "asc"}`;
            const response = await this.fetchImpl(`${url()}${separator}select=${encode(columns)}&order=${order}`, { headers });
            if (!response.ok) return { data: null, error: { message: await response.text() } };
            return { data: (await response.json()) as unknown[], error: null };
          },
          then: (onfulfilled: (value: RestResponse) => unknown, onrejected?: (reason: unknown) => unknown) => {
            const separator = state.filters.length ? "&" : "?";
            return this.fetchImpl(`${url()}${separator}select=${encode(columns)}`, { headers })
              .then(async (response) => response.ok
                ? { data: (await response.json()) as unknown[], error: null }
                : { data: null, error: { message: await response.text() } })
              .then(onfulfilled, onrejected);
          },
        };
        return builder;
      },
    };
  }
}

export interface SupabaseAuthUser {
  id: string;
  email?: string;
}

export async function getSupabaseAuthUser(
  baseUrl: string,
  anonKey: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<SupabaseAuthUser | undefined> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return undefined;
  const value = (await response.json()) as { id?: unknown; email?: unknown };
  return typeof value.id === "string" ? { id: value.id, ...(typeof value.email === "string" ? { email: value.email } : {}) } : undefined;
}
