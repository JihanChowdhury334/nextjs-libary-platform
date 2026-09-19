import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { books, categories } from "@/db/schema";
import type { BookQuery } from "@/lib/validation";

export type BrowseRow = {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  description: string | null;
  totalCopies: number;
  availableCopies: number;
  location: string | null;
  categoryId: number | null;
  categoryName: string | null;
  createdAt: Date | null;
};

export type BrowseResult = {
  books: BrowseRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Predicate for the browse view. Kept in one place because the benchmark in
 * scripts/benchmark-browse.ts measures this exact shape, and the point of that
 * measurement is that only the indexes change between runs.
 */
export function browseFilter(query: BookQuery): SQL | undefined {
  const clauses: (SQL | undefined)[] = [eq(books.isActive, true)];

  if (query.categoryId !== null) {
    clauses.push(eq(books.categoryId, query.categoryId));
  }

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    clauses.push(
      or(
        ilike(books.title, pattern),
        ilike(books.author, pattern),
        ilike(books.isbn, pattern),
        ilike(books.publisher, pattern)
      )
    );
  }

  return and(...clauses);
}

/** `%`, `_` and `\` are wildcards in LIKE; a user typing them means them literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * One page of the catalogue, filtered and sorted in Postgres.
 *
 * The previous implementation selected every row and filtered in JavaScript,
 * which meant the browse page transferred the whole table on each request and
 * paginated an already-materialised array. At 5,000 books that is ~5,000 rows
 * per page view regardless of how many are shown.
 */
export async function browseBooks(query: BookQuery): Promise<BrowseResult> {
  const where = browseFilter(query);
  const offset = (query.page - 1) * query.limit;

  const [rows, counted] = await Promise.all([
    db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        publisher: books.publisher,
        publicationYear: books.publicationYear,
        description: books.description,
        totalCopies: books.totalCopies,
        availableCopies: books.availableCopies,
        location: books.location,
        categoryId: books.categoryId,
        categoryName: categories.name,
        createdAt: books.createdAt,
      })
      .from(books)
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .where(where)
      .orderBy(asc(books.title), asc(books.id))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(books)
      .where(where),
  ]);

  const total = counted[0]?.count ?? 0;

  return {
    books: rows,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/** Aggregate counters for the browse header, computed in one pass over the table. */
export async function catalogueStats() {
  const [stats] = await db
    .select({
      totalTitles: sql<number>`count(*)::int`,
      availableTitles: sql<number>`count(*) filter (where ${books.availableCopies} > 0)::int`,
      totalCopies: sql<number>`coalesce(sum(${books.totalCopies}), 0)::int`,
      onLoan: sql<number>`coalesce(sum(${books.totalCopies} - ${books.availableCopies}), 0)::int`,
    })
    .from(books)
    .where(eq(books.isActive, true));

  return stats;
}
