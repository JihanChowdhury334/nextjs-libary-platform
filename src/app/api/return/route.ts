import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { returnBook } from "@/lib/loans";
import { parseReturn } from "@/lib/validation";
import { badRequest, fail, notFound, ok, readJson, serverError, unauthorized } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return unauthorized();

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = parseReturn(body.value);
    if (!parsed.ok) return badRequest("Invalid return request.", parsed.errors);

    const result = await returnBook(user.id, parsed.value.borrowingId);

    if (result.ok) {
      return ok({
        borrowingId: result.borrowingId,
        bookId: result.bookId,
        availableCopies: result.availableCopies,
      });
    }

    // "Not found" covers both a missing loan and one belonging to another user:
    // telling the caller which would leak the existence of other people's loans.
    return result.reason === "not_found"
      ? notFound("Loan")
      : fail(409, "already_returned", "This book has already been returned.");
  } catch (error) {
    return serverError("POST /api/return", error);
  }
}
