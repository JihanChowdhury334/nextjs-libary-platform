/**
 * A small structural validator. The routes need roughly a dozen rules; a
 * dependency would be more code to audit than this file is.
 *
 * Each parser returns either the narrowed value or a field-keyed error map, so
 * a route never has to trust the shape of `await request.json()`.
 */

export type Valid<T> = { ok: true; value: T };
export type Invalid = { ok: false; errors: Record<string, string> };
export type Parsed<T> = Valid<T> | Invalid;

type Field = { field: string; error: string };

class FieldErrors {
  private readonly items: Field[] = [];

  add(field: string, error: string) {
    this.items.push({ field, error });
  }

  get empty() {
    return this.items.length === 0;
  }

  toMap(): Record<string, string> {
    return Object.fromEntries(this.items.map((i) => [i.field, i.error]));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A positive integer, accepting the numeric strings that arrive from forms and query strings. */
export function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
}

function optionalTrimmed(
  raw: unknown,
  field: string,
  maxLength: number,
  errors: FieldErrors
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    errors.add(field, "Must be text.");
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.length > maxLength) {
    errors.add(field, `Must be ${maxLength} characters or fewer.`);
    return null;
  }
  return trimmed;
}

function requiredTrimmed(
  raw: unknown,
  field: string,
  maxLength: number,
  errors: FieldErrors
): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    errors.add(field, "This field is required.");
    return "";
  }
  const trimmed = raw.trim();
  if (trimmed.length > maxLength) {
    errors.add(field, `Must be ${maxLength} characters or fewer.`);
    return "";
  }
  return trimmed;
}

export type BorrowInput = { bookId: number };

export function parseBorrow(body: unknown): Parsed<BorrowInput> {
  const errors = new FieldErrors();
  if (!isRecord(body)) {
    return { ok: false, errors: { body: "Expected a JSON object." } };
  }
  const bookId = toPositiveInt(body.bookId);
  if (bookId === null) errors.add("bookId", "Must be a positive integer.");
  return errors.empty
    ? { ok: true, value: { bookId: bookId as number } }
    : { ok: false, errors: errors.toMap() };
}

export type ReturnInput = { borrowingId: number };

export function parseReturn(body: unknown): Parsed<ReturnInput> {
  const errors = new FieldErrors();
  if (!isRecord(body)) {
    return { ok: false, errors: { body: "Expected a JSON object." } };
  }
  const borrowingId = toPositiveInt(body.borrowingId);
  if (borrowingId === null) errors.add("borrowingId", "Must be a positive integer.");
  return errors.empty
    ? { ok: true, value: { borrowingId: borrowingId as number } }
    : { ok: false, errors: errors.toMap() };
}

export type NewBookInput = {
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  description: string | null;
  totalCopies: number;
  location: string | null;
  categoryId: number | null;
};

const MAX_COPIES = 10_000;
const EARLIEST_YEAR = 1000;

export function parseNewBook(body: unknown): Parsed<NewBookInput> {
  const errors = new FieldErrors();
  if (!isRecord(body)) {
    return { ok: false, errors: { body: "Expected a JSON object." } };
  }

  const title = requiredTrimmed(body.title, "title", 255, errors);
  const author = requiredTrimmed(body.author, "author", 255, errors);
  const isbn = optionalTrimmed(body.isbn, "isbn", 20, errors);
  const publisher = optionalTrimmed(body.publisher, "publisher", 255, errors);
  const location = optionalTrimmed(body.location, "location", 100, errors);
  const description = optionalTrimmed(body.description, "description", 5000, errors);

  let publicationYear: number | null = null;
  if (body.publicationYear !== undefined && body.publicationYear !== null && body.publicationYear !== "") {
    const year = toPositiveInt(body.publicationYear);
    const latest = new Date().getUTCFullYear() + 1;
    if (year === null || year < EARLIEST_YEAR || year > latest) {
      errors.add("publicationYear", `Must be a year between ${EARLIEST_YEAR} and ${latest}.`);
    } else {
      publicationYear = year;
    }
  }

  const totalCopies = toPositiveInt(body.totalCopies);
  if (totalCopies === null || totalCopies > MAX_COPIES) {
    errors.add("totalCopies", `Must be a whole number between 1 and ${MAX_COPIES}.`);
  }

  let categoryId: number | null = null;
  if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== "") {
    categoryId = toPositiveInt(body.categoryId);
    if (categoryId === null) errors.add("categoryId", "Must be a positive integer.");
  }

  return errors.empty
    ? {
        ok: true,
        value: {
          title,
          author,
          isbn,
          publisher,
          publicationYear,
          description,
          totalCopies: totalCopies as number,
          location,
          categoryId,
        },
      }
    : { ok: false, errors: errors.toMap() };
}

export type SignupInput = { name: string; email: string; password: string };

// Deliberately permissive: the only thing worth rejecting here is input that
// cannot be an address at all. Deliverability is not decidable by regex.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt truncates at 72 bytes; longer input is silently ignored, so reject it.
const MAX_PASSWORD_LENGTH = 72;

export function parseSignup(body: unknown): Parsed<SignupInput> {
  const errors = new FieldErrors();
  if (!isRecord(body)) {
    return { ok: false, errors: { body: "Expected a JSON object." } };
  }

  const name = requiredTrimmed(body.name, "name", 255, errors);

  let email = "";
  if (typeof body.email !== "string" || body.email.trim() === "") {
    errors.add("email", "This field is required.");
  } else {
    email = body.email.trim().toLowerCase();
    if (email.length > 255 || !EMAIL.test(email)) {
      errors.add("email", "Enter a valid email address.");
      email = "";
    }
  }

  const rawPassword = typeof body.password === "string" ? body.password : "";
  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    errors.add("password", `Must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  } else if (Buffer.byteLength(rawPassword, "utf8") > MAX_PASSWORD_LENGTH) {
    errors.add("password", `Must be ${MAX_PASSWORD_LENGTH} bytes or fewer.`);
  }

  return errors.empty
    ? { ok: true, value: { name, email, password: rawPassword } }
    : { ok: false, errors: errors.toMap() };
}

export type BookQuery = {
  search: string;
  categoryId: number | null;
  page: number;
  limit: number;
};

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;
const MAX_SEARCH_LENGTH = 100;

/** Query-string parsing never fails; out-of-range values clamp to something sane. */
export function parseBookQuery(params: URLSearchParams): BookQuery {
  const search = (params.get("search") ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const categoryId = toPositiveInt(params.get("category") ?? "");
  const page = toPositiveInt(params.get("page") ?? "") ?? 1;
  const requested = toPositiveInt(params.get("limit") ?? "") ?? DEFAULT_PAGE_SIZE;

  return {
    search,
    categoryId,
    page,
    limit: Math.min(requested, MAX_PAGE_SIZE),
  };
}
