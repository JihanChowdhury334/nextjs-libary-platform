import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { borrowBook } from "@/lib/loans";
import { parseBorrow } from "@/lib/validation";
import { badRequest, fail, notFound, ok, readJson, serverError, unauthorized } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return unauthorized();

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = parseBorrow(body.value);
    if (!parsed.ok) return badRequest("Invalid borrow request.", parsed.errors);

    const result = await borrowBook(user.id, parsed.value.bookId);

    if (result.ok) {
      return ok(
        {
          borrowingId: result.borrowingId,
          bookId: result.bookId,
          dueDate: result.dueDate,
          availableCopies: result.availableCopies,
        },
        201
      );
    }

    switch (result.reason) {
      case "book_not_found":
        return notFound("Book");
      case "unavailable":
        // 409: the request is well-formed, the resource state forbids it.
        return fail(409, "unavailable", "No copies of this book are available right now.");
      case "already_borrowed":
        return fail(409, "already_borrowed", "You already have this book on loan.");
    }
  } catch (error) {
    return serverError("POST /api/borrow", error);
  }
}
