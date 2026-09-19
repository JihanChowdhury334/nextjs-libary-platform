/**
 * Role vocabulary, with no database or server-only imports, so client
 * components can check a role without dragging `pg` into the browser bundle.
 */

export const ROLES = ["student", "faculty", "librarian", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed to mutate the catalogue. */
export const STAFF_ROLES: readonly Role[] = ["librarian", "admin"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
