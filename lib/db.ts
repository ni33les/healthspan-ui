import postgres from "postgres";

const globalDb = globalThis as typeof globalThis & {
  mattanutraSql?: postgres.Sql;
  mattanutraSqlConnectionKey?: string;
};

function shouldUseDirectSsl(connection: string) {
  try {
    const url = new URL(connection);

    return url.hostname.endsWith(".db.ondigitalocean.com");
  } catch {
    return false;
  }
}

export function getSql() {
  const connection = process.env.DB_CONNECTION;

  if (!connection) {
    return null;
  }

  const useDirectSsl = shouldUseDirectSsl(connection);
  const connectionKey = `${connection}|directSsl:${String(useDirectSsl)}`;

  if (
    globalDb.mattanutraSql &&
    globalDb.mattanutraSqlConnectionKey !== connectionKey
  ) {
    void globalDb.mattanutraSql.end();
    globalDb.mattanutraSql = undefined;
  }

  globalDb.mattanutraSql ??= postgres(connection, {
    max: 3,
    prepare: false,
    ...(useDirectSsl ? { ssl: "require", sslnegotiation: "direct" } : {})
  });
  globalDb.mattanutraSqlConnectionKey = connectionKey;

  return globalDb.mattanutraSql;
}
