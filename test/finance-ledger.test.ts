import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDigitalOceanBillingCostEntries,
  digitalOceanBillingSyncConfiguration,
  parseDigitalOceanProjectNames,
  syncDigitalOceanBillingCosts,
  type FinanceTransactionInput
} from "../lib/finance-ledger.ts";

async function withBillingEnv<T>(
  env: Readonly<{
    DIGITALOCEAN_ACCESS_TOKEN?: string;
    DIGITALOCEAN_PROJECT_NAME?: string;
  }>,
  run: () => Promise<T> | T
) {
  const originalToken = process.env.DIGITALOCEAN_ACCESS_TOKEN;
  const originalProject = process.env.DIGITALOCEAN_PROJECT_NAME;

  try {
    if (env.DIGITALOCEAN_ACCESS_TOKEN === undefined) {
      delete process.env.DIGITALOCEAN_ACCESS_TOKEN;
    } else {
      process.env.DIGITALOCEAN_ACCESS_TOKEN = env.DIGITALOCEAN_ACCESS_TOKEN;
    }

    if (env.DIGITALOCEAN_PROJECT_NAME === undefined) {
      delete process.env.DIGITALOCEAN_PROJECT_NAME;
    } else {
      process.env.DIGITALOCEAN_PROJECT_NAME = env.DIGITALOCEAN_PROJECT_NAME;
    }

    return await run();
  } finally {
    if (originalToken === undefined) {
      delete process.env.DIGITALOCEAN_ACCESS_TOKEN;
    } else {
      process.env.DIGITALOCEAN_ACCESS_TOKEN = originalToken;
    }

    if (originalProject === undefined) {
      delete process.env.DIGITALOCEAN_PROJECT_NAME;
    } else {
      process.env.DIGITALOCEAN_PROJECT_NAME = originalProject;
    }
  }
}

describe("DigitalOcean finance ledger sync", () => {
  it("parses comma-separated project filters case-insensitively", () => {
    assert.deepEqual(
      parseDigitalOceanProjectNames(" Mattanutra , Demo Project ,, UAT "),
      ["mattanutra", "demo project", "uat"]
    );
  });

  it("builds nominal hosting ledger entries only for selected projects", () => {
    const entries = buildDigitalOceanBillingCostEntries({
      items: [
        {
          amount: "1.23",
          description: "App Platform",
          end_time: "2026-05-12T00:00:00.000Z",
          project_name: "Mattanutra",
          start_time: "2026-05-01T00:00:00.000Z",
          uuid: "line-app"
        },
        {
          amount: "9.99",
          description: "Managed Database",
          project_name: "Other Project",
          uuid: "line-db"
        },
        {
          amount: "0",
          description: "Zero line",
          project_name: "Mattanutra",
          uuid: "line-zero"
        }
      ],
      projectNames: parseDigitalOceanProjectNames("mattanutra")
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.amount, 1_230_000);
    assert.equal(entries[0]?.category, "hosting");
    assert.equal(entries[0]?.entryType, "nominal");
    assert.equal(entries[0]?.provider, "digitalocean");
    assert.equal(entries[0]?.currency, "USD");
    assert.equal(entries[0]?.from, "mattanutra:platform");
    assert.equal(entries[0]?.to, "digitalocean");
    assert.match(
      entries[0]?.sourceRef ?? "",
      /^digitalocean:invoice-preview:/
    );
  });

  it("skips cleanly when billing env vars are missing", async () => {
    await withBillingEnv(
      {
        DIGITALOCEAN_PROJECT_NAME: "Mattanutra"
      },
      async () => {
        assert.deepEqual(digitalOceanBillingSyncConfiguration(), {
          configured: false,
          projects: ["mattanutra"],
          reason: "missing_token"
        });
        assert.deepEqual(await syncDigitalOceanBillingCosts(), {
          reason: "missing_token",
          skipped: true,
          synced: 0
        });
      }
    );

    await withBillingEnv(
      {
        DIGITALOCEAN_ACCESS_TOKEN: "token"
      },
      async () => {
        assert.deepEqual(digitalOceanBillingSyncConfiguration(), {
          configured: false,
          projects: [],
          reason: "missing_project_name"
        });
        assert.deepEqual(await syncDigitalOceanBillingCosts(), {
          reason: "missing_project_name",
          skipped: true,
          synced: 0
        });
      }
    );
  });

  it("uses stable source refs so repeat syncs update ledger rows", async () => {
    await withBillingEnv(
      {
        DIGITALOCEAN_ACCESS_TOKEN: "token",
        DIGITALOCEAN_PROJECT_NAME: "Mattanutra"
      },
      async () => {
        const recorded: FinanceTransactionInput[] = [];
        const invoiceItem = {
          amount: "1.00",
          description: "App Platform",
          end_time: "2026-05-31T23:59:59.000Z",
          project_name: "Mattanutra",
          resource_uuid: "app-resource",
          start_time: "2026-05-01T00:00:00.000Z"
        };
        const recorder = async (input: FinanceTransactionInput) => {
          recorded.push(input);

          return input.sourceRef ?? null;
        };

        await syncDigitalOceanBillingCosts({
          fetcher: async () =>
            new Response(JSON.stringify({ invoice_items: [invoiceItem] })),
          recorder,
          taskId: "00000000-0000-4000-8000-000000000001"
        });
        await syncDigitalOceanBillingCosts({
          fetcher: async () =>
            new Response(
              JSON.stringify({
                invoice_items: [{ ...invoiceItem, amount: "2.50" }]
              })
            ),
          recorder,
          taskId: "00000000-0000-4000-8000-000000000002"
        });

        assert.equal(recorded.length, 2);
        assert.equal(recorded[0]?.sourceRef, recorded[1]?.sourceRef);
        assert.equal(recorded[0]?.amount, 1_000_000);
        assert.equal(recorded[1]?.amount, 2_500_000);
        assert.equal(
          recorded[1]?.taskId,
          "00000000-0000-4000-8000-000000000002"
        );
      }
    );
  });
});
