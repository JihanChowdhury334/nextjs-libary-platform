import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres instance."
  );
}

// Managed Postgres (Neon, Supabase, RDS) terminates TLS with a certificate this
// process has no root for; a local instance usually speaks no TLS at all.
// Opting in per-URL keeps local development working without turning off
// verification everywhere.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX ?? 10),
});

export const db = drizzle(pool, { schema });
export { pool };
