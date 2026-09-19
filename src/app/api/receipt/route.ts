import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { borrowings, books, users } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { toPositiveInt } from "@/lib/validation";
import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    // Previously this route took any borrowing id and returned the borrower's
    // name and email. It is now scoped to the caller's own loans.
    const user = await currentUser();
    if (!user) return unauthorized();

    const borrowingId = toPositiveInt(new URL(request.url).searchParams.get("id") ?? "");
    if (borrowingId === null) return badRequest("Loan id must be a positive integer.");

    const rows = await db
      .select({
        id: borrowings.id,
        borrowedAt: borrowings.borrowedAt,
        dueDate: borrowings.dueDate,
        returnedAt: borrowings.returnedAt,
        status: borrowings.status,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        borrowerName: users.name,
        borrowerEmail: users.email,
      })
      .from(borrowings)
      .innerJoin(books, eq(borrowings.bookId, books.id))
      .innerJoin(users, eq(borrowings.userId, users.id))
      .where(and(eq(borrowings.id, borrowingId), eq(borrowings.userId, user.id)))
      .limit(1);

    if (rows.length === 0) return notFound("Loan");

    const r = rows[0];
    return ok({
      receipt: {
        loanId: r.id,
        borrowedAt: r.borrowedAt,
        dueDate: r.dueDate,
        returnedAt: r.returnedAt,
        status: r.status,
        book: { title: r.title, author: r.author, isbn: r.isbn },
        borrower: { name: r.borrowerName, email: r.borrowerEmail },
      },
    });
  } catch (error) {
    return serverError("GET /api/receipt", error);
  }
}
