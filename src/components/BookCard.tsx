import Link from "next/link";
import { BookMarked, MapPin, Tag } from "lucide-react";
import BorrowButton from "@/components/BorrowButton";
import type { BrowseRow } from "@/lib/books";

export default function BookCard({ book }: { book: BrowseRow }) {
  const available = book.availableCopies > 0;

  return (
    <li className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="heading-3 min-w-0 break-words">
              <Link
                href={`/books/${book.id}`}
                className="hover:text-[var(--color-accent-soft)]"
              >
                {book.title}
              </Link>
            </h3>
            <span className={available ? "chip chip-ok" : "chip chip-danger"}>
              {available
                ? `${book.availableCopies} of ${book.totalCopies} available`
                : "All copies on loan"}
            </span>
          </div>

          <p className="text-muted mt-1 text-[length:var(--text-small)]">
            {book.author}
            {book.publicationYear ? ` · ${book.publicationYear}` : ""}
            {book.publisher ? ` · ${book.publisher}` : ""}
          </p>

          {book.description && (
            <p className="text-subtle mt-3 line-clamp-2 text-[length:var(--text-small)]">
              {book.description}
            </p>
          )}

          <ul className="text-subtle mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-micro)]">
            <li className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              {book.categoryName ?? "Uncategorised"}
            </li>
            {book.location && (
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {book.location}
              </li>
            )}
            {book.isbn && (
              <li className="inline-flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-mono">{book.isbn}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="shrink-0">
          <BorrowButton
            bookId={book.id}
            available={available}
            className="btn btn-secondary"
          />
        </div>
      </div>
    </li>
  );
}
