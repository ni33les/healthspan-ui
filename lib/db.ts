import postgres from "postgres";

const globalDb = globalThis as typeof globalThis & {
  mattanutraSql?: postgres.Sql;
};

export function getSql() {
  const connection = process.env.DB_CONNECTION;

  if (!connection) {
    return null;
  }

  globalDb.mattanutraSql ??= postgres(connection, {
    max: 3,
    prepare: false
  });

  return globalDb.mattanutraSql;
}
