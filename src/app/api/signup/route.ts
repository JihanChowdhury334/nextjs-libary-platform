import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users } from "@/db/schema";
import { parseSignup } from "@/lib/validation";
import { badRequest, fail, ok, readJson, serverError } from "@/lib/api";
import { isUniqueViolation } from "@/lib/db-errors";

const BCRYPT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = parseSignup(body.value);
    if (!parsed.ok) return badRequest("Invalid signup details.", parsed.errors);

    const { name, email, password } = parsed.value;
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      // Role is fixed server-side. Self-service signup can never mint staff;
      // promoting an account is a database operation, by design.
      const [created] = await db
        .insert(users)
        .values({ name, email, password: hashed, role: "student" })
        .returning({ id: users.id, name: users.name, email: users.email });

      return ok({ user: created }, 201);
    } catch (error) {
      if (isUniqueViolation(error, "users_email_unique")) {
        return fail(409, "email_taken", "An account with that email already exists.");
      }
      throw error;
    }
  } catch (error) {
    return serverError("POST /api/signup", error);
  }
}
