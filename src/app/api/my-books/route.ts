import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { borrowings, books, categories } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { ok, serverError, unauthorized } from "@/lib/api";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return unauthorized();

    const loans = await db
      .select({
        id: borrowings.id,
        bookId: borrowings.bookId,
        borrowedAt: borrowings.borrowedAt,
        dueDate: borrowings.dueDate,
        returnedAt: borrowings.returnedAt,
        status: borrowings.status,
        bookTitle: books.title,
        bookAuthor: books.author,
        categoryName: categories.name,
      })
      .from(borrowings)
      .innerJoin(books, eq(borrowings.bookId, books.id))
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .where(eq(borrowings.userId, user.id))
      .orderBy(desc(borrowings.borrowedAt));

    return ok({ loans });
  } catch (error) {
    return serverError("GET /api/my-books", error);
  }
}
