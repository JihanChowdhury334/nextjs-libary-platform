import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, ShieldCheck, Timer } from "lucide-react";
import { catalogueStats } from "@/lib/books";
import { StatCard } from "@/components/StatCard";
import { StatSkeleton } from "@/components/States";

// The counters were hard-coded zeroes. They come from the database now, which
// is why the page is no longer statically cached.
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Searchable catalogue",
    body: "Filter by title, author, ISBN, publisher or category. Searching and paging happen in the database, not in the browser.",
  },
  {
    icon: ShieldCheck,
    title: "Consistent inventory",
    body: "A copy is claimed with a single conditional update, so two people racing for the last copy cannot both get it.",
  },
  {
    icon: Timer,
    title: "Loan tracking",
    body: "Fourteen-day loans, one active loan per title per borrower, with due dates and overdue state on your account page.",
  },
];

async function Counters() {
  const stats = await catalogueStats();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Titles" value={stats.totalTitles.toLocaleString()} />
      <StatCard label="Copies" value={stats.totalCopies.toLocaleString()} />
      <StatCard label="On loan" value={stats.onLoan.toLocaleString()} />
      <StatCard label="Titles available" value={stats.availableTitles.toLocaleString()} />
    </div>
  );
}

export default function Home() {
  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body flex flex-col gap-14">
        <section className="flex flex-col gap-5">
          <p className="eyebrow">University library</p>
          <h1 className="heading-1 max-w-3xl">
            Find a book, borrow it, bring it back.
          </h1>
          <p className="text-lead max-w-2xl">
            A catalogue and loan system for a university library. Every copy is
            accounted for: the borrow path is safe under concurrent requests, and
            the inventory rules are enforced by the database rather than by the
            screen you happen to be looking at.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/books" className="btn btn-primary">
              Browse the catalogue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/signup" className="btn btn-secondary">
              Create an account
            </Link>
          </div>
        </section>

        <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
          <h2 id="stats-heading" className="heading-2">
            The collection right now
          </h2>
          <Suspense fallback={<StatSkeleton />}>
            <Counters />
          </Suspense>
        </section>

        <section aria-labelledby="features-heading" className="flex flex-col gap-4">
          <h2 id="features-heading" className="heading-2">
            How it works
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="card">
                <Icon className="h-5 w-5 text-[var(--color-accent-soft)]" aria-hidden="true" />
                <h3 className="heading-3 mt-3">{title}</h3>
                <p className="text-muted mt-2 text-[length:var(--text-small)]">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
