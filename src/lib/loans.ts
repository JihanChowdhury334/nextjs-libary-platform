import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { books, borrowings } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";

/** Days a loan runs before it is due. */
export const LOAN_PERIOD_DAYS = 14;

/** Name of the partial unique index that enforces one active loan per user+book. */
export const ACTIVE_LOAN_INDEX = "borrowings_one_active_loan_per_user_book";

export type BorrowFailure =
  | "book_not_found"
  | "unavailable"
  | "already_borrowed";

export type BorrowResult =
  | {
      ok: true;
      borrowingId: number;
      bookId: number;
      dueDate: string;
      availableCopies: number;
    }
  | { ok: false; reason: BorrowFailure };

export type ReturnFailure = "not_found" | "already_returned";

export type ReturnResult =
  | { ok: true; borrowingId: number; bookId: number; availableCopies: number }
  | { ok: false; reason: ReturnFailure };

export function dueDateFrom(borrowedAt: Date): string {
  const due = new Date(borrowedAt);
  due.setUTCDate(due.getUTCDate() + LOAN_PERIOD_DAYS);
  return due.toISOString().slice(0, 10);
}

/**
 * Borrow one copy of a book.
 *
 * Two invariants have to survive concurrent callers, and neither is checked in
 * application code:
 *
 *  1. `available_copies` never goes below zero. The decrement is a single
 *     conditional UPDATE — `SET available_copies = available_copies - 1 WHERE id
 *     = $1 AND available_copies > 0`. Postgres takes a row lock for the duration
 *     of that statement, so concurrent updaters serialise on it and each one
 *     re-evaluates `available_copies > 0` against the committed value. When the
 *     last copy is gone the predicate is false and the statement reports zero
 *     affected rows, which is what "unavailable" means here. Nothing is ever
 *     read into the application and written back, so there is no window between
 *     the check and the write for another request to slip through.
 *
 *  2. A user holds at most one active loan of a given book. That is a partial
 *     unique index on (user_id, book_id) WHERE status = 'borrowed'. A duplicate
 *     INSERT raises unique_violation and is reported as `already_borrowed`.
 *
 * Both statements run in one transaction, so a rejected duplicate rolls the
 * decrement back with it and no copy is leaked.
 */
export async function borrowBook(
  userId: number,
  bookId: number
): Promise<BorrowResult> {
  try {
    return await db.transaction(async (tx) => {
      // Conditional decrement. Zero rows means "no copy was available to take".
      const claimed = await tx
        .update(books)
        .set({
          availableCopies: sql`${books.availableCopies} - 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(books.id, bookId),
            eq(books.isActive, true),
            sql`${books.availableCopies} > 0`
          )
        )
        .returning({ availableCopies: books.availableCopies });

      if (claimed.length === 0) {
        // Only now, on the failure path, is it worth a second query to say
        // *why* nothing was claimed.
        const exists = await tx
          .select({ id: books.id })
          .from(books)
          .where(and(eq(books.id, bookId), eq(books.isActive, true)))
          .limit(1);

        return {
          ok: false as const,
          reason: exists.length === 0 ? ("book_not_found" as const) : ("unavailable" as const),
        };
      }

      const borrowedAt = new Date();
      const inserted = await tx
        .insert(borrowings)
        .values({
          userId,
          bookId,
          dueDate: dueDateFrom(borrowedAt),
          status: "borrowed",
        })
        .returning({ id: borrowings.id, dueDate: borrowings.dueDate });

      return {
        ok: true as const,
        borrowingId: inserted[0].id,
        bookId,
        dueDate: inserted[0].dueDate,
        availableCopies: claimed[0].availableCopies,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error, ACTIVE_LOAN_INDEX)) {
      // The transaction rolled back, so the decrement above is undone.
      return { ok: false, reason: "already_borrowed" };
    }
    throw error;
  }
}

/**
 * Return a loan. Mirror image of {@link borrowBook}, and idempotent for the same
 * reason: the status transition is itself a conditional UPDATE guarded by
 * `status = 'borrowed'`. The first call flips the row and increments the book;
 * every later call matches zero rows, so the increment never runs twice and the
 * copy count cannot be inflated by replaying the request.
 */
export async function returnBook(
  userId: number,
  borrowingId: number
): Promise<ReturnResult> {
  return db.transaction(async (tx) => {
    const closed = await tx
      .update(borrowings)
      .set({ status: "returned", returnedAt: new Date() })
      .where(
        and(
          eq(borrowings.id, borrowingId),
          eq(borrowings.userId, userId),
          eq(borrowings.status, "borrowed")
        )
      )
      .returning({ id: borrowings.id, bookId: borrowings.bookId });

    if (closed.length === 0) {
      const existing = await tx
        .select({ status: borrowings.status })
        .from(borrowings)
        .where(and(eq(borrowings.id, borrowingId), eq(borrowings.userId, userId)))
        .limit(1);

      return {
        ok: false as const,
        reason:
          existing.length === 0
            ? ("not_found" as const)
            : ("already_returned" as const),
      };
    }

    // Reached at most once per loan, so this can never overshoot total_copies.
    // The books_available_lte_total CHECK is the backstop if it ever does.
    const restored = await tx
      .update(books)
      .set({
        availableCopies: sql`${books.availableCopies} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(books.id, closed[0].bookId))
      .returning({ availableCopies: books.availableCopies });

    return {
      ok: true as const,
      borrowingId: closed[0].id,
      bookId: closed[0].bookId,
      availableCopies: restored[0].availableCopies,
    };
  });
}
