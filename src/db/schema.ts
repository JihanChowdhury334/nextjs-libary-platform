import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  text,
  boolean,
  date,
  decimal,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// Users table (students, faculty, librarians, admins)
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("student"),
    studentId: varchar("student_id", { length: 50 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    isApproved: boolean("is_approved").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    check("users_role_valid", sql`${t.role} in ('student', 'faculty', 'librarian', 'admin')`),
  ]
);

// Book categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Books catalog
export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    isbn: varchar("isbn", { length: 20 }),
    publisher: varchar("publisher", { length: 255 }),
    publicationYear: integer("publication_year"),
    description: text("description"),
    coverImage: varchar("cover_image", { length: 500 }),
    totalCopies: integer("total_copies").notNull().default(1),
    availableCopies: integer("available_copies").notNull().default(1),
    categoryId: integer("category_id").references(() => categories.id),
    location: varchar("location", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    // Inventory invariants. The borrow path relies on these: a conditional
    // UPDATE is the first line of defence, these are the last.
    check("books_total_copies_non_negative", sql`${t.totalCopies} >= 0`),
    check("books_available_copies_non_negative", sql`${t.availableCopies} >= 0`),
    check("books_available_lte_total", sql`${t.availableCopies} <= ${t.totalCopies}`),
    // Supports the browse query: filter on is_active (+ optional category),
    // order by title. Leading the index with the filter columns lets Postgres
    // walk it in title order and stop at LIMIT instead of sorting the matches.
    index("books_active_title_idx").on(t.isActive, t.title),
    index("books_active_category_title_idx").on(t.isActive, t.categoryId, t.title),
    // No trigram (pg_trgm GIN) index here, deliberately. Measured on the seeded
    // 5,000-row table: the planner never chose one. The browse query sorts by
    // title and takes 12 rows, so walking books_active_title_idx in order and
    // filtering lets it stop after ~13 rows -- cheaper than building a bitmap
    // over the whole table. A trigram index also has to be declared on
    // (title::text), because ILIKE casts varchar to text and an index on the
    // bare varchar column never matches the predicate. Worth revisiting if the
    // catalogue grows by an order of magnitude; not worth four GIN indexes'
    // write cost today.
  ]
);

// Book borrowings (loans)
export const borrowings = pgTable(
  "borrowings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    bookId: integer("book_id")
      .references(() => books.id)
      .notNull(),
    borrowedAt: timestamp("borrowed_at").defaultNow(),
    dueDate: date("due_date").notNull(),
    returnedAt: timestamp("returned_at"),
    status: varchar("status", { length: 20 }).notNull().default("borrowed"),
    fineAmount: decimal("fine_amount", { precision: 10, scale: 2 }).default("0.00"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    check("borrowings_status_valid", sql`${t.status} in ('borrowed', 'returned')`),
    // A returned loan must carry a return timestamp; an active one must not.
    check(
      "borrowings_returned_at_matches_status",
      sql`(${t.status} = 'returned') = (${t.returnedAt} is not null)`
    ),
    // THE duplicate-active-loan invariant. A partial unique index means the
    // database, not the application, rejects a second concurrent borrow of the
    // same book by the same user. Returned rows are excluded, so the same user
    // can borrow the same book again after returning it.
    uniqueIndex("borrowings_one_active_loan_per_user_book")
      .on(t.userId, t.bookId)
      .where(sql`${t.status} = 'borrowed'`),
    index("borrowings_user_status_idx").on(t.userId, t.status),
    index("borrowings_book_status_idx").on(t.bookId, t.status),
  ]
);

// Book reservations
export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    bookId: integer("book_id")
      .references(() => books.id)
      .notNull(),
    reservedAt: timestamp("reserved_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("reservations_user_status_idx").on(t.userId, t.status)]
);

// Fines for overdue books
export const fines = pgTable(
  "fines",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    borrowingId: integer("borrowing_id")
      .references(() => borrowings.id)
      .notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 255 }),
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("fines_user_unpaid_idx").on(t.userId, t.isPaid)]
);

export type Book = typeof books.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Borrowing = typeof borrowings.$inferSelect;
export type User = typeof users.$inferSelect;
