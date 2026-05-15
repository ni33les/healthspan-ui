import type postgres from "postgres";

type Db = postgres.Sql | postgres.TransactionSql;

const globalSafetyReviewSchema = globalThis as typeof globalThis & {
  mattanutraSafetyReviewItemColumns?: Promise<boolean>;
};

export async function safetyReviewItemColumnsAvailable(sql: Db) {
  globalSafetyReviewSchema.mattanutraSafetyReviewItemColumns ??= (async () => {
    const rows = await sql<Array<{ column_name: string }>>`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'safety_reviews'
        and column_name = any(${["item_name", "item_type"]}::text[])
    `;
    const columns = new Set(rows.map((row) => row.column_name));

    return columns.has("item_name") && columns.has("item_type");
  })().catch((error) => {
    globalSafetyReviewSchema.mattanutraSafetyReviewItemColumns = undefined;
    throw error;
  });

  return globalSafetyReviewSchema.mattanutraSafetyReviewItemColumns;
}
