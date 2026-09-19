import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { books, borrowings, categories, users } from "@/db/schema";
import { currentUser, hasRole, STAFF_ROLES } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

async function stats() {
  const today = new Date().toISOString().slice(0, 10);

  // Previously this page pulled every row of four tables into memory and
  // counted them in JavaScript. Postgres does the counting now.
  const [catalogue] = await db
    .select({
      titles: sql<number>`count(*)::int`,
      copies: sql<number>`coalesce(sum(${books.totalCopies}), 0)::int`,
      onLoan: sql<number>`coalesce(sum(${books.totalCopies} - ${books.availableCopies}), 0)::int`,
      withdrawn: sql<number>`count(*) filter (where not ${books.isActive})::int`,
    })
    .from(books);

  const [[people], [categoryCount], [activeLoans], [overdueLoans]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(categories),
    db.select({ n: count() }).from(borrowings).where(eq(borrowings.status, "borrowed")),
    db
      .select({ n: count() })
      .from(borrowings)
      .where(and(eq(borrowings.status, "borrowed"), lt(borrowings.dueDate, today))),
  ]);

  return {
    ...catalogue,
    users: people.n,
    categories: categoryCount.n,
    activeLoans: activeLoans.n,
    overdueLoans: overdueLoans.n,
  };
}

export default async function AdminPage() {
  // This page had no access check at all: anyone who typed /admin saw the
  // library's user count and loan figures.
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/admin");
  if (!hasRole(user, STAFF_ROLES)) redirect("/books");

  const s = await stats();

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">Staff</p>
            <h1 className="heading-1">Admin</h1>
            <p className="text-lead">Collection and circulation at a glance.</p>
          </div>
          <Link href="/books/new" className="btn btn-primary">
            Add a book
          </Link>
        </header>

        <section aria-labelledby="collection-heading" className="flex flex-col gap-4">
          <h2 id="collection-heading" className="heading-2">
            Collection
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Titles" value={s.titles.toLocaleString()} />
            <StatCard label="Copies" value={s.copies.toLocaleString()} />
            <StatCard label="Categories" value={s.categories.toLocaleString()} />
            <StatCard
              label="Withdrawn"
              value={s.withdrawn.toLocaleString()}
              hint="not shown in the catalogue"
            />
          </div>
        </section>

        <section aria-labelledby="circulation-heading" className="flex flex-col gap-4">
          <h2 id="circulation-heading" className="heading-2">
            Circulation
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active loans" value={s.activeLoans.toLocaleString()} />
            <StatCard label="Overdue" value={s.overdueLoans.toLocaleString()} />
            <StatCard label="Copies out" value={s.onLoan.toLocaleString()} />
            <StatCard label="Registered users" value={s.users.toLocaleString()} />
          </div>
        </section>

        <p className="text-subtle text-[length:var(--text-small)]">
          Editing books, managing users and browsing loan history are not built
          yet. Signed in as {user.email} ({user.role}).
        </p>
      </div>
    </div>
  );
}
