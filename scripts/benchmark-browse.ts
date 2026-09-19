/**
 * Measures the browse page's search/filter query with and without its indexes.
 *
 * The SQL is produced once, by the same Drizzle query builder the application
 * uses, and then executed verbatim in both phases. The indexes are the only
 * variable: nothing about the statement, the parameters or the data changes
 * between the "before" and "after" numbers.
 *
 *   npm run db:seed && npm run db:benchmark
 */
import { asc, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { books, categories } from "@/db/schema";
import { browseFilter } from "@/lib/books";
import type { BookQuery } from "@/lib/validation";

const RUNS = Number(process.env.BENCH_RUNS ?? 25);
const WARMUP = Number(process.env.BENCH_WARMUP ?? 5);

/** Indexes under test. Dropped for the "before" phase, recreated for "after". */
const INDEXES: Record<string, string> = {
  books_active_title_idx: `CREATE INDEX books_active_title_idx ON books USING btree (is_active, title)`,
  books_active_category_title_idx: `CREATE INDEX books_active_category_title_idx ON books USING btree (is_active, category_id, title)`,
};

type Scenario = { name: string; description: string; query: BookQuery };

const SCENARIOS: Scenario[] = [
  {
    name: "category filter + sort",
    description: "browsing one category, sorted by title, first page",
    query: { search: "", categoryId: 3, page: 1, limit: 12 },
  },
  {
    name: "substring search + sort",
    description: "typing a term into the search box, sorted by title, first page",
    query: { search: "Distributed", categoryId: null, page: 1, limit: 12 },
  },
];

/** The browse page also asks for a total, to size its pagination. */
function renderCountQuery(query: BookQuery) {
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(books)
    .where(browseFilter(query))
    .toSQL();
}

/** Renders the browse query to the exact SQL text and parameters the app sends. */
function renderBrowseQuery(query: BookQuery) {
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      publisher: books.publisher,
      publicationYear: books.publicationYear,
      description: books.description,
      totalCopies: books.totalCopies,
      availableCopies: books.availableCopies,
      location: books.location,
      categoryId: books.categoryId,
      categoryName: categories.name,
      createdAt: books.createdAt,
    })
    .from(books)
    .leftJoin(categories, eq(books.categoryId, categories.id))
    .where(browseFilter(query))
    .orderBy(asc(books.title), asc(books.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .toSQL();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function dropIndexes() {
  for (const name of Object.keys(INDEXES)) {
    await db.execute(sql.raw(`DROP INDEX IF EXISTS ${name}`));
  }
  await db.execute(sql.raw("ANALYZE books"));
}

async function createIndexes() {
  for (const ddl of Object.values(INDEXES)) {
    await db.execute(sql.raw(ddl));
  }
  await db.execute(sql.raw("ANALYZE books"));
}

async function time(text: string, params: unknown[]) {
  const timings: number[] = [];
  let rowCount = 0;

  for (let i = 0; i < WARMUP + RUNS; i++) {
    const started = process.hrtime.bigint();
    const result = await pool.query(text, params as never[]);
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (i >= WARMUP) timings.push(elapsed);
    rowCount = result.rowCount ?? 0;
  }

  return { timings, rowCount };
}

/** The top-level node of the plan, which is what "scan type" means here. */
async function explain(text: string, params: unknown[]) {
  const result = await pool.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${text}`,
    params as never[]
  );
  const lines = (result.rows as { "QUERY PLAN": string }[]).map((r) => r["QUERY PLAN"]);
  const scans = lines
    .map((l) => l.trim().replace(/^->\s*/, ""))
    .filter((l) => / Scan | Sort\b/.test(l) || /^(Seq|Index|Bitmap|Sort)/.test(l))
    .map((l) => l.split("  ")[0]);
  return { text: lines.join("\n"), scans };
}

async function matchingRows(query: BookQuery): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(books)
    .where(browseFilter(query));
  return row.count;
}

async function main() {
  const [{ count: bookCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(books);
  const [{ v }] = (
    await pool.query<{ v: string }>("select version() as v")
  ).rows.map((r) => ({ v: r.v }));

  console.log("=".repeat(78));
  console.log("Browse query benchmark");
  console.log("=".repeat(78));
  console.log(v.split(" on ")[0]);
  console.log(`books in table: ${bookCount}`);
  console.log(`runs per phase: ${RUNS} timed (${WARMUP} warm-up discarded)\n`);

  const prepared = SCENARIOS.flatMap((s) => [
    { name: `${s.name} (page)`, description: s.description, query: s.query, sql: renderBrowseQuery(s.query) },
    {
      name: `${s.name} (count)`,
      description: `${s.description} -- the COUNT(*) that sizes the pager`,
      query: s.query,
      sql: renderCountQuery(s.query),
    },
  ]);

  for (const s of prepared) {
    console.log(`--- ${s.name} -----------------------------------------------`);
    console.log(s.description);
    console.log(`matching rows: ${await matchingRows(s.query)} of ${bookCount}`);
    console.log(`SQL: ${s.sql.sql}`);
    console.log(`params: ${JSON.stringify(s.sql.params)}\n`);
  }

  const results: Record<string, Record<string, unknown>> = {};

  for (const phase of ["before", "after"] as const) {
    if (phase === "before") await dropIndexes();
    else await createIndexes();

    console.log("=".repeat(78));
    console.log(
      phase === "before"
        ? "PHASE 1 — no indexes on books beyond the primary key"
        : "PHASE 2 — indexes created (identical SQL, identical data)"
    );
    console.log("=".repeat(78));

    for (const s of prepared) {
      const { timings, rowCount } = await time(s.sql.sql, s.sql.params);
      const plan = await explain(s.sql.sql, s.sql.params);

      results[`${s.name}/${phase}`] = {
        medianMs: median(timings),
        p95Ms: percentile(timings, 95),
        minMs: Math.min(...timings),
        maxMs: Math.max(...timings),
        rowsReturned: rowCount,
        scans: plan.scans,
      };

      console.log(`\n[${s.name}]`);
      console.log(
        `  median ${median(timings).toFixed(2)} ms   ` +
          `p95 ${percentile(timings, 95).toFixed(2)} ms   ` +
          `min ${Math.min(...timings).toFixed(2)} ms   ` +
          `max ${Math.max(...timings).toFixed(2)} ms   ` +
          `rows ${rowCount}`
      );
      console.log("  plan:");
      console.log(
        plan.text
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n")
      );
    }
    console.log();
  }

  console.log("=".repeat(78));
  console.log("SUMMARY");
  console.log("=".repeat(78));
  for (const s of prepared) {
    const before = results[`${s.name}/before`] as { medianMs: number; scans: string[]; rowsReturned: number };
    const after = results[`${s.name}/after`] as { medianMs: number; scans: string[]; rowsReturned: number };
    console.log(`\n${s.name}`);
    console.log(`  rows returned : ${before.rowsReturned} (before) / ${after.rowsReturned} (after)`);
    console.log(`  median before : ${before.medianMs.toFixed(2)} ms   top node: ${before.scans[0] ?? "n/a"}`);
    console.log(`  median after  : ${after.medianMs.toFixed(2)} ms   top node: ${after.scans[0] ?? "n/a"}`);
    console.log(
      `  change        : ${(before.medianMs / after.medianMs).toFixed(2)}x ` +
        `(${(before.medianMs - after.medianMs).toFixed(2)} ms faster)`
    );
  }
  console.log();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
