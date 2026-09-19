import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, categories } from "@/db/schema";
import { toPositiveInt } from "@/lib/validation";
import { badRequest, notFound, ok, serverError } from "@/lib/api";

// Next.js 15 passes dynamic params as a Promise.
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const bookId = toPositiveInt(id);
    if (bookId === null) return badRequest("Book id must be a positive integer.");

    const rows = await db
      .select({
        book: books,
        category: categories,
      })
      .from(books)
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .where(and(eq(books.id, bookId), eq(books.isActive, true)))
      .limit(1);

    if (rows.length === 0) return notFound("Book");

    return ok({ book: rows[0].book, category: rows[0].category });
  } catch (error) {
    return serverError("GET /api/books/[id]", error);
  }
}
