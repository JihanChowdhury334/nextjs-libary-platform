import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { books, categories } from "@/db/schema";
import { currentUser, hasRole, STAFF_ROLES } from "@/lib/auth";
import { browseBooks } from "@/lib/books";
import { parseBookQuery, parseNewBook } from "@/lib/validation";
import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const query = parseBookQuery(new URL(request.url).searchParams);
    return ok(await browseBooks(query));
  } catch (error) {
    return serverError("GET /api/books", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Adding to the catalogue is a staff action. The navbar hides the link for
    // everyone else, but the check that matters is this one.
    const user = await currentUser();
    if (!user) return unauthorized();
    if (!hasRole(user, STAFF_ROLES)) return forbidden();

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = parseNewBook(body.value);
    if (!parsed.ok) return badRequest("Invalid book details.", parsed.errors);

    const input = parsed.value;

    if (input.categoryId !== null) {
      const category = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);
      if (category.length === 0) {
        return badRequest("Invalid book details.", {
          categoryId: "No such category.",
        });
      }
    }

    // A new book starts fully on the shelf: availableCopies is derived, never
    // taken from the client, so it cannot be set above totalCopies.
    const [created] = await db
      .insert(books)
      .values({
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        publisher: input.publisher,
        publicationYear: input.publicationYear,
        description: input.description,
        location: input.location,
        categoryId: input.categoryId,
        totalCopies: input.totalCopies,
        availableCopies: input.totalCopies,
        isActive: true,
      })
      .returning();

    return ok({ book: created }, 201);
  } catch (error) {
    return serverError("POST /api/books", error);
  }
}
