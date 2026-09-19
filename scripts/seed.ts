/**
 * Seeds a realistic catalogue. Deterministic (fixed PRNG seed) so the benchmark
 * in scripts/benchmark-browse.ts measures the same data on every run.
 *
 *   npm run db:seed              # ~5,000 books
 *   BOOK_COUNT=500 npm run db:seed
 */
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, pool } from "@/db";
import { books, borrowings, categories, users } from "@/db/schema";

const BOOK_COUNT = Number(process.env.BOOK_COUNT ?? 5000);
const BATCH_SIZE = 500;
// Enough borrowers that a title with several copies out can have a distinct
// borrower per copy -- one active loan per user per book is a hard constraint.
const BORROWER_COUNT = Number(process.env.BORROWER_COUNT ?? 60);

// mulberry32: small, deterministic, good enough for generating catalogue text.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = rng(20240917);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

function shuffled<T>(xs: readonly T[]): T[] {
  const copy = [...xs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CATEGORIES = [
  ["Computer Science", "Algorithms, systems, programming languages and theory"],
  ["Mathematics", "Pure and applied mathematics"],
  ["Physics", "Classical, quantum and applied physics"],
  ["Engineering", "Mechanical, electrical, civil and chemical engineering"],
  ["Biology", "Cell biology, genetics, ecology and evolution"],
  ["Chemistry", "Organic, inorganic and physical chemistry"],
  ["History", "World, regional and thematic history"],
  ["Philosophy", "Ethics, logic, metaphysics and epistemology"],
  ["Economics", "Micro, macro, development and econometrics"],
  ["Psychology", "Cognitive, clinical, social and developmental psychology"],
  ["Literature", "Fiction, poetry, drama and criticism"],
  ["Political Science", "Governance, international relations and theory"],
] as const;

const TITLE_LEAD = [
  "Introduction to", "Principles of", "Foundations of", "Advanced", "A Survey of",
  "Readings in", "The Structure of", "Elements of", "Modern", "Applied",
  "Topics in", "Concepts in", "The Practice of", "Essentials of", "Perspectives on",
];

const TITLE_SUBJECT = [
  "Distributed Systems", "Compiler Design", "Real Analysis", "Quantum Mechanics",
  "Organic Synthesis", "Molecular Genetics", "Medieval Europe", "Formal Logic",
  "Macroeconomic Policy", "Cognitive Development", "Comparative Literature",
  "International Relations", "Numerical Methods", "Statistical Inference",
  "Operating Systems", "Thermodynamics", "Fluid Mechanics", "Population Ecology",
  "Discrete Structures", "Database Systems", "Machine Learning", "Control Theory",
  "Electromagnetism", "Cell Signalling", "Political Economy", "Moral Philosophy",
  "Graph Theory", "Signal Processing", "Materials Science", "Behavioural Economics",
];

const TITLE_QUALIFIER = ["", "", " in Practice", " for Engineers", " and Its Applications",
  " Reconsidered", " at Scale", " for Scientists", ", Volume I", ", Volume II"];

const TITLE_TAIL = ["", "", "", ", Second Edition", ", Third Edition", ": A Modern Approach",
  ": Theory and Practice", ": An Introduction", ", Revised Edition"];

const FIRST = ["Ada", "Alan", "Grace", "Donald", "Barbara", "Edsger", "Frances", "Leslie",
  "Maria", "Chen", "Priya", "Yusuf", "Ingrid", "Tomas", "Amara", "Kenji", "Sofia",
  "Nadia", "Oliver", "Ravi", "Elena", "Kwame", "Hana", "Lucas", "Mei", "Farid"];
const LAST = ["Lovelace", "Turing", "Hopper", "Knuth", "Liskov", "Dijkstra", "Allen",
  "Lamport", "Okonkwo", "Nakamura", "Sharma", "Haddad", "Bergström", "Novak",
  "Diallo", "Watanabe", "Reyes", "Petrova", "Gallagher", "Iyer", "Costa", "Mensah"];

const PUBLISHERS = ["Aldgate Academic Press", "Northfield University Press",
  "Marlowe & Sons", "Cascade Scientific", "Harrowgate Books", "Linden Hall Publishing",
  "Ferrier Technical", "Ostwald Verlag", "Bellweather Press", "Quarry Lane Academic"];

function isbn13(n: number): string {
  const body = `978${String(n).padStart(9, "0")}`;
  const check =
    (10 -
      ([...body].reduce((sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 1 : 3), 0) % 10)) %
    10;
  return `${body}${check}`;
}

async function main() {
  console.log(`Seeding ${BOOK_COUNT} books...`);
  const started = Date.now();

  await db.execute(
    sql`truncate table ${borrowings}, ${books}, ${categories}, ${users} restart identity cascade`
  );

  const categoryRows = await db
    .insert(categories)
    .values(CATEGORIES.map(([name, description]) => ({ name, description })))
    .returning({ id: categories.id, name: categories.name });

  // Two accounts so the app is clickable straight after seeding. Passwords are
  // fixed and printed on purpose: this is local sample data, not a deployment.
  const hashed = await bcrypt.hash("password123", 12);
  await db.insert(users).values([
    { name: "Library Admin", email: "admin@library.local", password: hashed, role: "admin", isApproved: true },
    { name: "Sample Student", email: "student@library.local", password: hashed, role: "student", isApproved: true },
  ]);

  const borrowers = await db
    .insert(users)
    .values(
      Array.from({ length: BORROWER_COUNT }, (_, i) => ({
        name: `${pick(FIRST)} ${pick(LAST)}`,
        email: `borrower${i + 1}@library.local`,
        password: hashed,
        role: "student" as const,
        isApproved: true,
      }))
    )
    .returning({ id: users.id });

  let inserted = 0;
  let loanCount = 0;
  for (let start = 0; start < BOOK_COUNT; start += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, BOOK_COUNT - start);
    const copiesOut: number[] = [];
    const batch = Array.from({ length: size }, (_, i) => {
      const n = start + i + 1;
      const total = between(1, 6);
      // Roughly a third of the catalogue has at least one copy out on loan.
      const out = random() < 0.35 ? between(1, total) : 0;
      copiesOut.push(out);
      return {
        title: `${pick(TITLE_LEAD)} ${pick(TITLE_SUBJECT)}${pick(TITLE_QUALIFIER)}${pick(TITLE_TAIL)}`,
        author: `${pick(FIRST)} ${pick(LAST)}`,
        isbn: isbn13(n),
        publisher: pick(PUBLISHERS),
        publicationYear: between(1960, 2025),
        description:
          `A ${pick(["concise", "comprehensive", "rigorous", "accessible", "classic"])} treatment of the subject, ` +
          `used in ${pick(["undergraduate", "graduate", "introductory", "advanced"])} courses.`,
        totalCopies: total,
        availableCopies: total - out,
        categoryId: pick(categoryRows).id,
        location: `${String.fromCharCode(65 + between(0, 9))}${between(1, 24)}-${between(1, 8)}`,
        // ~2% withdrawn from circulation, so the is_active filter is not a no-op.
        isActive: random() > 0.02,
      };
    });

    const created = await db.insert(books).values(batch).returning({ id: books.id });

    // Every copy marked as out gets a real loan row, so available_copies and
    // the borrowings table agree. Without this the admin figures contradict
    // each other: copies on loan, but no loans.
    const loans = created.flatMap((book, i) => {
      const out = copiesOut[i];
      if (out === 0) return [];
      // Distinct borrowers per title: the partial unique index forbids a second
      // active loan of the same book by the same user.
      const chosen = shuffled(borrowers).slice(0, out);
      return chosen.map((borrower) => {
        const daysAgo = between(0, 20);
        const borrowedAt = new Date(Date.now() - daysAgo * 86_400_000);
        const due = new Date(borrowedAt);
        due.setUTCDate(due.getUTCDate() + 14);
        return {
          userId: borrower.id,
          bookId: book.id,
          borrowedAt,
          dueDate: due.toISOString().slice(0, 10),
          status: "borrowed" as const,
        };
      });
    });

    if (loans.length > 0) {
      await db.insert(borrowings).values(loans);
      loanCount += loans.length;
    }

    inserted += size;
    if (inserted % 1000 === 0) console.log(`  ${inserted}/${BOOK_COUNT}`);
  }

  await db.execute(sql`analyze books`);
  await db.execute(sql`analyze borrowings`);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(books);
  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s: ` +
      `${count} books, ${categoryRows.length} categories, ` +
      `${BORROWER_COUNT + 2} users, ${loanCount} active loans.`
  );
  console.log("Sign in as admin@library.local / password123 (local sample data).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
