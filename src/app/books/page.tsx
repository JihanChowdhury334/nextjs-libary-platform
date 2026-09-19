import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { browseBooks, catalogueStats } from "@/lib/books";
import { parseBookQuery } from "@/lib/validation";
import BookSearchForm from "@/components/BookSearchForm";
import BookCard from "@/components/BookCard";
import Pagination from "@/components/Pagination";
import { StatCard } from "@/components/StatCard";
import { BookListSkeleton, EmptyState, StatSkeleton } from "@/components/States";

export const metadata = { title: "Catalogue" };

// Rendered per request: the page reflects live availability, and the filters
// live in the query string.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

async function Stats() {
  const stats = await catalogueStats();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Titles" value={stats.totalTitles.toLocaleString()} />
      <StatCard label="Copies" value={stats.totalCopies.toLocaleString()} />
      <StatCard label="On loan" value={stats.onLoan.toLocaleString()} />
      <StatCard
        label="Titles available"
        value={stats.availableTitles.toLocaleString()}
        hint="at least one copy on the shelf"
      />
    </div>
  );
}

async function Results({ params }: { params: URLSearchParams }) {
  const query = parseBookQuery(params);
  const result = await browseBooks(query);
  const filtered = Boolean(query.search || query.categoryId);

  if (result.books.length === 0) {
    return filtered ? (
      <EmptyState
        title="No books match those filters"
        body="Try a shorter search term, or clear the category filter."
        action={{ href: "/books", label: "Clear filters" }}
      />
    ) : (
      <EmptyState
        title="The catalogue is empty"
        body="Once books are added they will appear here. Run the seed script to load sample data."
      />
    );
  }

  const first = (query.page - 1) * query.limit + 1;
  const last = Math.min(query.page * query.limit, result.total);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-subtle text-[length:var(--text-small)]" aria-live="polite">
        Showing {first.toLocaleString()}–{last.toLocaleString()} of{" "}
        {result.total.toLocaleString()} {result.total === 1 ? "book" : "books"}
        {query.search ? ` matching “${query.search}”` : ""}
      </p>

      <ul className="grid gap-4">
        {result.books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </ul>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        params={Object.fromEntries(params.entries())}
      />
    </div>
  );
}

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = toParams(raw);

  const allCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">Catalogue</p>
          <h1 className="heading-1">Browse the collection</h1>
          <p className="text-lead max-w-2xl">
            Search by title, author, ISBN or publisher. Availability is live —
            each figure reflects copies currently on the shelf.
          </p>
        </header>

        <Suspense fallback={<StatSkeleton />}>
          <Stats />
        </Suspense>

        <BookSearchForm categories={allCategories} />

        <Suspense key={params.toString()} fallback={<BookListSkeleton />}>
          <Results params={params} />
        </Suspense>
      </div>
    </div>
  );
}
