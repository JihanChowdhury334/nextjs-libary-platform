import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Building2, Calendar, Hash, MapPin, Tag, User } from "lucide-react";
import { db } from "@/db";
import { books, categories } from "@/db/schema";
import { toPositiveInt } from "@/lib/validation";
import BorrowButton from "@/components/BorrowButton";

// This was a client component that imported the database module directly, which
// cannot run in the browser. It is a server component now: one query, no
// client-side fetch, no loading flash.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadBook(id: string) {
  const bookId = toPositiveInt(id);
  if (bookId === null) return null;

  const rows = await db
    .select({ book: books, categoryName: categories.name })
    .from(books)
    .leftJoin(categories, eq(books.categoryId, categories.id))
    .where(and(eq(books.id, bookId), eq(books.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await loadBook(id);
  return { title: row ? row.book.title : "Book not found" };
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="eyebrow">{label}</dt>
        <dd className="text-[length:var(--text-small)] break-words">{children}</dd>
      </div>
    </div>
  );
}

export default async function BookPage({ params }: Props) {
  const { id } = await params;
  const row = await loadBook(id);

  if (!row) notFound();

  const { book, categoryName } = row;
  const available = book.availableCopies > 0;

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body flex flex-col gap-6">
        <Link
          href="/books"
          className="text-subtle inline-flex items-center gap-2 text-[length:var(--text-small)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the catalogue
        </Link>

        <article className="card flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="heading-1 min-w-0 break-words">{book.title}</h1>
              <span className={available ? "chip chip-ok" : "chip chip-danger"}>
                {available ? "Available" : "All copies on loan"}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Detail icon={User} label="Author">
                {book.author}
              </Detail>
              <Detail icon={Tag} label="Category">
                {categoryName ?? "Uncategorised"}
              </Detail>
              {book.publisher && (
                <Detail icon={Building2} label="Publisher">
                  {book.publisher}
                  {book.publicationYear ? ` (${book.publicationYear})` : ""}
                </Detail>
              )}
              {book.isbn && (
                <Detail icon={Hash} label="ISBN">
                  <span className="font-mono">{book.isbn}</span>
                </Detail>
              )}
              {book.location && (
                <Detail icon={MapPin} label="Shelf">
                  {book.location}
                </Detail>
              )}
              {book.createdAt && (
                <Detail icon={Calendar} label="Added">
                  <time dateTime={book.createdAt.toISOString()}>
                    {book.createdAt.toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </Detail>
              )}
            </dl>

            {book.description && (
              <div className="mt-8">
                <h2 className="heading-3">Description</h2>
                <p className="text-muted mt-2 max-w-prose">{book.description}</p>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 lg:w-72">
            <div className="card card-tight bg-[var(--color-surface-2)]">
              <p className="eyebrow">Availability</p>
              <p className="mt-1 text-[length:var(--text-h2)] font-semibold tabular-nums">
                {book.availableCopies}
                <span className="text-subtle text-[length:var(--text-body)] font-normal">
                  {" "}
                  / {book.totalCopies}
                </span>
              </p>
              <p className="text-subtle mt-0.5 text-[length:var(--text-micro)]">
                copies on the shelf
              </p>

              <div className="mt-4">
                <BorrowButton
                  bookId={book.id}
                  available={available}
                  className="btn btn-primary w-full"
                />
              </div>

              <p className="text-subtle mt-3 text-[length:var(--text-micro)]">
                Loans run for 14 days. You can hold one copy of a title at a time.
              </p>
            </div>
          </aside>
        </article>
      </div>
    </div>
  );
}
