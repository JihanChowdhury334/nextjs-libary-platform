/**
 * Drizzle wraps driver failures in a DrizzleQueryError and hangs the original
 * `pg` error off `cause`, so the SQLSTATE is not on the object that gets thrown.
 * Everything that branches on a constraint violation goes through here.
 */

export type PgError = { code?: string; constraint?: string; detail?: string };

/** Postgres SQLSTATEs this application distinguishes. */
export const UNIQUE_VIOLATION = "23505";
export const CHECK_VIOLATION = "23514";
export const FOREIGN_KEY_VIOLATION = "23503";

export function pgErrorOf(error: unknown): PgError | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as PgError & { cause?: unknown };
    if (typeof candidate.code === "string") return candidate;
    current = candidate.cause;
  }
  return null;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgErrorOf(error);
  if (pg?.code !== UNIQUE_VIOLATION) return false;
  return constraint === undefined || pg.constraint === constraint;
}

export function isCheckViolation(error: unknown, constraint?: string): boolean {
  const pg = pgErrorOf(error);
  if (pg?.code !== CHECK_VIOLATION) return false;
  return constraint === undefined || pg.constraint === constraint;
}
