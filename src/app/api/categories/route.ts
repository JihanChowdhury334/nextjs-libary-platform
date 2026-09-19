import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ok, serverError } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db
      .select({ id: categories.id, name: categories.name, description: categories.description })
      .from(categories)
      .orderBy(asc(categories.name));
    return ok({ categories: rows });
  } catch (error) {
    return serverError("GET /api/categories", error);
  }
}
