import { describe, expect, it } from "vitest";
import { SupabasePersistence, type SupabaseClientLike } from "../src/integrations/supabase-repository.js";
import type { Opportunity } from "../src/domain/opportunity.js";
import type { ApprovalRequest } from "../src/domain/approval.js";

function fakeClient() {
  const rows: Record<string, unknown>[] = [];
  const client: SupabaseClientLike = {
    from(table) {
      return {
        upsert(values) {
          const incoming = Array.isArray(values) ? values : [values];
          for (const value of incoming) {
            const key = table === "opportunities"
              ? `${value.user_id}:${value.source}:${value.source_url}`
              : String(value.id);
            const index = rows.findIndex((row) => String(row.__key) === key);
            const next = { ...value, __table: table, __key: key };
            if (index >= 0) rows[index] = next; else rows.push(next);
          }
          return Promise.resolve({ error: null });
        },
        select() {
          const builder = {
            eq(column: string, value: string) {
              const filtered = rows.filter((row) => row.__table === table && String(row[column]) === value);
              return {
                ...builder,
                then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: filtered, error: null })),
              } as never;
            },
            order() {
              const filtered = rows.filter((row) => row.__table === table);
              return Promise.resolve({ data: filtered, error: null });
            },
            then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
              const filtered = rows.filter((row) => row.__table === table);
              return Promise.resolve(resolve({ data: filtered, error: null }));
            },
          };
          return builder;
        },
      };
    },
  };
  return { client, rows };
}

const opportunity: Opportunity = {
  id: "job-1", source: "test", sourceUrl: "https://example.com/job-1", title: "React Engineer",
  description: "Remote React work", skills: ["React"], workMode: "remote", status: "new", discoveredAt: "2026-09-07T00:00:00Z",
};

const approval: ApprovalRequest = {
  id: "approval:job-1", opportunityId: "job-1", proposal: "Application", state: "pending", createdAt: "2026-09-07T00:00:00Z",
};

describe("SupabasePersistence", () => {
  it("persists and reads opportunities for the current user", async () => {
    const { client } = fakeClient();
    const store = new SupabasePersistence(client, "user-1");
    await store.saveOpportunity(opportunity);
    const found = await store.getOpportunity("job-1");
    expect(found?.title).toBe("React Engineer");
    expect((await store.listOpportunities())).toHaveLength(1);
  });

  it("persists and filters pending approvals", async () => {
    const { client } = fakeClient();
    const store = new SupabasePersistence(client, "user-1");
    await store.saveOpportunity(opportunity);
    await store.saveApproval(approval);
    expect((await store.listPendingApprovals())).map((item) => item.id).toEqual(["approval:job-1"]);
  });
});
