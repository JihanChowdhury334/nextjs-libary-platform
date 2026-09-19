import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { currentUser, hasRole, STAFF_ROLES } from "@/lib/auth";
import NewBookForm from "@/components/NewBookForm";

export const metadata = { title: "Add a book" };
export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  // Gate the page on the server. The API route checks the same thing again;
  // this one only decides what to render.
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/books/new");
  if (!hasRole(user, STAFF_ROLES)) redirect("/books");

  const allCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">Catalogue</p>
          <h1 className="heading-1">Add a book</h1>
          <p className="text-lead">
            New titles start with every copy on the shelf.
          </p>
        </header>

        <NewBookForm categories={allCategories} />
      </div>
    </div>
  );
}
