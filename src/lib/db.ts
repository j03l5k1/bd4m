import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/* eslint-disable @typescript-eslint/no-explicit-any */

let sql: ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>) | null = null;

/**
 * The neon HTTP driver returns `timestamp`/`timestamptz` columns as JS `Date`
 * objects and ignores the `types` type-parser option. The previous
 * supabase-js/PostgREST layer returned them as ISO strings, and this codebase
 * relies on that: several paths interpolate the raw value straight into a
 * string — e.g. `source_key = ${kickoff_at}|...` — where a `Date` stringifies
 * to "Mon Feb 23 2026 …" and breaks lookups.
 *
 * So we normalize every returned row: any `Date` becomes an ISO string,
 * matching the old contract exactly with no call-site changes.
 */
function normalizeRow(row: Record<string, any>): Record<string, any> {
  for (const key in row) {
    if (row[key] instanceof Date) row[key] = row[key].toISOString();
  }
  return row;
}

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

  const base: NeonQueryFunction<false, false> = neon(url);

  sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
    base(strings, ...values).then((rows) =>
      Array.isArray(rows) ? rows.map((r) => normalizeRow(r as Record<string, any>)) : rows
    );

  return sql;
}
