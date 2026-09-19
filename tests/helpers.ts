import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { books, borrowings, categories, users } from "@/db/schema";

/**
 * Tests run against a real Postgres instance, not a mock. The invariants under
 * test are database invariants — a fake would only prove the fake works.
 */
export async function resetDatabase() {
  await db.execute(
    sql`truncate table ${borrowings}, ${books}, ${categories}, ${users} restart identity cascade`
  );
  userSeq = 0;
}

export async function createCategory(name: string): Promise<number> {
  const [row] = await db.insert(categories).values({ name }).returning({ id: categories.id });
  return row.id;
}

export async function createBook(opts: {
  title: string;
  copies: number;
  categoryId?: number;
}): Promise<number> {
  const [row] = await db
    .insert(books)
    .values({
      title: opts.title,
      author: "Test Author",
      totalCopies: opts.copies,
      availableCopies: opts.copies,
      categoryId: opts.categoryId ?? null,
    })
    .returning({ id: books.id });
  return row.id;
}

// Emails are unique in the schema, so hand out fresh ones rather than letting a
// second createUsers() call in the same test collide with the first.
let userSeq = 0;

export async function createUsers(count: number): Promise<number[]> {
  const rows = await db
    .insert(users)
    .values(
      Array.from({ length: count }, () => ({
        name: `User ${++userSeq}`,
        email: `user${userSeq}@test.local`,
        // Not a usable credential: these tests never go through the auth flow.
        password: "not-a-real-hash",
        role: "student" as const,
      }))
    )
    .returning({ id: users.id });
  return rows.map((r) => r.id);
}

export async function availableCopies(bookId: number): Promise<number> {
  const result = await db.execute<{ available_copies: number }>(
    sql`select available_copies from ${books} where id = ${bookId}`
  );
  return Number(result.rows[0].available_copies);
}

export async function activeLoanCount(bookId: number): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from ${borrowings} where book_id = ${bookId} and status = 'borrowed'`
  );
  return Number(result.rows[0].n);
}

/**
 * Reads `available_copies` on a loop while `work` runs, on a connection of its
 * own, so the samples come from committed state during the burst rather than
 * only after it. Used to assert the counter is never observed negative.
 */
export async function sampleWhile<T>(
  bookId: number,
  work: () => Promise<T>
): Promise<{ result: T; samples: number[] }> {
  const samples: number[] = [];
  let running = true;

  const sampler = (async () => {
    while (running) {
      try {
        samples.push(await availableCopies(bookId));
      } catch {
        // A sample lost to pool contention is not a test failure.
      }
      await new Promise((r) => setImmediate(r));
    }
  })();

  try {
    const result = await work();
    return { result, samples };
  } finally {
    running = false;
    await sampler;
  }
}

export async function closePool() {
  await pool.end();
}
