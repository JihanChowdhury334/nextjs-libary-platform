import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

/**
 * The pool is created on first use, not on import.
 *
 * Next.js imports every route module during the "Collecting page data" step of
 * a production build. If this module demanded DATABASE_URL at import time, a
 * build would fail on any machine that has no database configured -- including
 * a CI or Vercel build where the variable is only present at runtime. Deferring
 * means a build needs no database, while the first query still fails with a
 * useful message rather than whatever `pg` does with an undefined connection
 * string (it silently falls back to libpq defaults and tries localhost).
 */

let pooled: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres instance."
    );
  }

  // Managed Postgres (Neon, Supabase, RDS) terminates TLS with a certificate
  // this process has no root for; a local instance usually speaks no TLS at
  // all. Opting in per-URL keeps local development working without turning off
  // verification everywhere.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);

  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: Number(process.env.PGPOOL_MAX ?? 10),
  });
}

export function getPool(): Pool {
  pooled ??= createPool();
  return pooled;
}

function getDb(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getPool(), { schema });
  return database;
}

/**
 * `db` and `pool` behave like the objects they stand in for; the proxy only
 * delays construction until the first property access.
 */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      const instance = resolve();
      const value = Reflect.get(instance, property, receiver);
      return typeof value === "function" ? value.bind(instance) : value;
    },
    has: (_target, property) => property in resolve(),
  });
}

export const db = lazy(getDb);
export const pool = lazy(getPool);
