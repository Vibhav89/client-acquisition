import type { SupabaseClientLike } from "./supabase-repository.js";

type FetchLike = typeof fetch;
type QueryResult = { data: unknown[] | null; error: { message: string } | null };
type QueryBuilder = ReturnType<SupabaseRestClient["from"]>["select"] extends (...args: never[]) => infer R ? R : never;

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
    const base = `${this.baseUrl.replace(/\/$/, "")}/rest/v1/${encode(table)}`;
    const url = () => {
      const query = state.filters.map(([column, value]) => `${encode(column)}=eq.${encode(value)}`).join("&");
      return `${base}${query ? `?${query}` : ""}`;
    };
    const headers = {
      apikey: this.anonKey,
      authorization: `Bearer ${this.accessToken}`,
      "content-type": "application/json",
    };

    const request = async (columns: string, order?: { column: string; ascending?: boolean }): Promise<QueryResult> => {
      const separator = state.filters.length ? "&" : "?";
      const orderQuery = order ? `&order=${encode(order.column)}.${order.ascending === false ? "desc" : "asc"}` : "";
      const response = await this.fetchImpl(`${url()}${separator}select=${encode(columns)}${orderQuery}`, { headers });
      if (!response.ok) return { data: null, error: { message: await response.text() } };
      return { data: (await response.json()) as unknown[], error: null };
    };

    const tableApi = {
      upsert: async (values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) => {
        const target = options?.onConflict ? `?on_conflict=${encode(options.onConflict)}` : "";
        const response = await this.fetchImpl(`${base}${target}`, {
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
          order: (column: string, options?: { ascending?: boolean }) => request(columns, { column, ...options }),
          then: <TResult1 = QueryResult, TResult2 = never>(
            onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ): PromiseLike<TResult1 | TResult2> => request(columns).then(onfulfilled ?? undefined, onrejected ?? undefined),
        };
        return builder;
      },
    };
    return tableApi;
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
