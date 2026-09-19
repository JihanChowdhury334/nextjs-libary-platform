"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, RotateCcw } from "lucide-react";
import { apiFetch, postJson } from "@/lib/client";
import { BookListSkeleton, EmptyState, ErrorState } from "@/components/States";
import { StatCard } from "@/components/StatCard";

type Loan = {
  id: number;
  bookId: number;
  borrowedAt: string | null;
  dueDate: string;
  returnedAt: string | null;
  status: string;
  bookTitle: string;
  bookAuthor: string;
  categoryName: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00Z`).getTime();
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.round((due - today) / DAY);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyBooksPage() {
  const { status } = useSession();
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [returning, setReturning] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const result = await apiFetch<{ loans: Loan[] }>("/api/my-books");
    if (result.ok) setLoans(result.data.loans);
    else {
      setLoans([]);
      setLoadError(result.message);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/signin?callbackUrl=/my-books");
    if (status === "authenticated") void load();
  }, [status, router, load]);

  async function handleReturn(loanId: number) {
    setReturning(loanId);
    setActionError(null);

    const result = await postJson("/api/return", { borrowingId: loanId });
    setReturning(null);

    // A duplicate return is not an error worth alarming the user about — the
    // book is returned either way. Re-sync and move on.
    if (!result.ok && result.code !== "already_returned") {
      setActionError(result.message);
    }
    await load();
  }

  const active = loans?.filter((l) => l.status === "borrowed") ?? [];
  const overdue = active.filter((l) => daysUntil(l.dueDate) < 0);
  const returned = loans?.filter((l) => l.status === "returned") ?? [];

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">Account</p>
          <h1 className="heading-1">My loans</h1>
          <p className="text-lead">Books you have out, and everything you have returned.</p>
        </header>

        {status === "loading" || loans === null ? (
          <BookListSkeleton rows={3} />
        ) : loadError ? (
          <ErrorState body={loadError} onRetry={() => void load()} />
        ) : loans.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
            title="No loans yet"
            body="Books you borrow will show up here with their due dates."
            action={{ href: "/books", label: "Browse the catalogue" }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="On loan" value={active.length} />
              <StatCard label="Overdue" value={overdue.length} />
              <StatCard label="Returned" value={returned.length} />
              <StatCard label="Total" value={loans.length} />
            </div>

            {actionError && (
              <p role="alert" className="field-error">
                {actionError}
              </p>
            )}

            <ul className="grid gap-4">
              {loans.map((loan) => {
                const isActive = loan.status === "borrowed";
                const days = daysUntil(loan.dueDate);
                const isOverdue = isActive && days < 0;
                const dueSoon = isActive && days >= 0 && days <= 3;

                return (
                  <li key={loan.id} className="card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="heading-3 min-w-0 break-words">
                            <Link
                              href={`/books/${loan.bookId}`}
                              className="hover:text-[var(--color-accent-soft)]"
                            >
                              {loan.bookTitle}
                            </Link>
                          </h2>
                          <span
                            className={
                              !isActive
                                ? "chip chip-neutral"
                                : isOverdue
                                  ? "chip chip-danger"
                                  : dueSoon
                                    ? "chip chip-warn"
                                    : "chip chip-ok"
                            }
                          >
                            {!isActive
                              ? "Returned"
                              : isOverdue
                                ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
                                : `Due in ${days} ${days === 1 ? "day" : "days"}`}
                          </span>
                        </div>

                        <p className="text-muted mt-1 text-[length:var(--text-small)]">
                          {loan.bookAuthor}
                          {loan.categoryName ? ` · ${loan.categoryName}` : ""}
                        </p>

                        <dl className="text-subtle mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--text-micro)]">
                          <div className="flex gap-1.5">
                            <dt>Borrowed</dt>
                            <dd>{formatDate(loan.borrowedAt)}</dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt>Due</dt>
                            <dd>{formatDate(loan.dueDate)}</dd>
                          </div>
                          {loan.returnedAt && (
                            <div className="flex gap-1.5">
                              <dt>Returned</dt>
                              <dd>{formatDate(loan.returnedAt)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => void handleReturn(loan.id)}
                          disabled={returning === loan.id}
                          className="btn btn-secondary shrink-0"
                        >
                          {returning === loan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          )}
                          {returning === loan.id ? "Returning…" : "Return"}
                          <span className="sr-only"> {loan.bookTitle}</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
