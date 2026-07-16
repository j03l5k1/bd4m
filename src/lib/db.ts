import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

/**
 * Returns a tagged-template SQL client backed by a standard Postgres
 * connection string. Vendor-neutral: works with Neon or any Postgres host
 * that provides a `postgres://` URL.
 *
 * Usage:
 *   const sql = getSql();
 *   const rows = await sql`select id from games where source_key = ${key}`;
 *
 * For list membership use ANY over an array:
 *   await sql`select id from games where kickoff_iso = ANY(${candidates})`;
 */
export function getSql() {
  if (sql) return sql;

  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) throw new Error("Missing DATABASE_URL");

  sql = neon(url);
  return sql;
}
