import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { borrowings } from "@/db/schema";
import { borrowBook, returnBook } from "@/lib/loans";
import { pgErrorOf } from "@/lib/db-errors";
import {
  activeLoanCount,
  availableCopies,
  closePool,
  createBook,
  createCategory,
  createUsers,
  resetDatabase,
  sampleWhile,
} from "./helpers.ts";

const CONCURRENCY = 20;

let categoryId: number;

before(async () => {
  await resetDatabase();
  categoryId = await createCategory("Test Category");
});

after(closePool);

describe("borrow under concurrency", () => {
  let bookId: number;
  let userIds: number[];

  beforeEach(async () => {
    await resetDatabase();
    categoryId = await createCategory("Test Category");
    bookId = await createBook({ title: "The Only Copy", copies: 1, categoryId });
    userIds = await createUsers(CONCURRENCY);
  });

  test(`${CONCURRENCY} distinct users racing for 1 copy: exactly one wins`, async () => {
    const { result: results, samples } = await sampleWhile(bookId, () =>
      Promise.all(userIds.map((userId) => borrowBook(userId, bookId)))
    );

    const succeeded = results.filter((r) => r.ok);
    const unavailable = results.filter((r) => !r.ok && r.reason === "unavailable");

    assert.equal(succeeded.length, 1, "exactly one borrow should succeed");
    assert.equal(
      unavailable.length,
      CONCURRENCY - 1,
      "every other borrow should be rejected as unavailable"
    );

    const remaining = await availableCopies(bookId);
    assert.equal(remaining, 0, "available_copies should settle at 0");
    assert.equal(await activeLoanCount(bookId), 1, "exactly one active loan should exist");

    // The counter is never observed below zero, at any point during the burst
    // or after it.
    assert.ok(samples.length > 0, "sampler should have taken at least one reading");
    assert.ok(
      samples.every((s) => s >= 0),
      `available_copies went negative mid-burst: ${JSON.stringify(samples)}`
    );

    console.log(
      `  -> ${succeeded.length} of ${CONCURRENCY} succeeded, available ended at ${remaining}, ` +
        `${samples.length} mid-burst samples, min observed ${Math.min(...samples)}`
    );
  });

  test(`${CONCURRENCY} users racing for 5 copies: exactly five win`, async () => {
    const fiveCopyBook = await createBook({ title: "Five Copies", copies: 5, categoryId });

    const { result: results, samples } = await sampleWhile(fiveCopyBook, () =>
      Promise.all(userIds.map((userId) => borrowBook(userId, fiveCopyBook)))
    );

    assert.equal(results.filter((r) => r.ok).length, 5);
    assert.equal(await availableCopies(fiveCopyBook), 0);
    assert.equal(await activeLoanCount(fiveCopyBook), 5);
    assert.ok(samples.every((s) => s >= 0 && s <= 5));

    console.log(
      `  -> 5 of ${CONCURRENCY} succeeded, available ended at 0, min observed ${Math.min(...samples)}`
    );
  });
});

describe("duplicate borrow", () => {
  let bookId: number;
  let userId: number;

  beforeEach(async () => {
    await resetDatabase();
    categoryId = await createCategory("Test Category");
    bookId = await createBook({ title: "Plenty Of Copies", copies: 5, categoryId });
    [userId] = await createUsers(1);
  });

  test("the same user borrowing twice in sequence is rejected", async () => {
    const first = await borrowBook(userId, bookId);
    assert.ok(first.ok);

    const second = await borrowBook(userId, bookId);
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "already_borrowed");

    assert.equal(await availableCopies(bookId), 4, "the rejected borrow must not consume a copy");
    assert.equal(await activeLoanCount(bookId), 1);

    console.log("  -> 1 of 2 succeeded, available ended at 4");
  });

  test(`the same user firing ${CONCURRENCY} concurrent borrows gets exactly one loan`, async () => {
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => borrowBook(userId, bookId))
    );

    const succeeded = results.filter((r) => r.ok).length;
    assert.equal(succeeded, 1, "exactly one concurrent borrow should succeed");

    const remaining = await availableCopies(bookId);
    assert.equal(remaining, 4, "only one copy should have been consumed");
    assert.equal(await activeLoanCount(bookId), 1);

    console.log(`  -> ${succeeded} of ${CONCURRENCY} succeeded, available ended at ${remaining}`);
  });

  test("the constraint lives in the database, not the application", async () => {
    const first = await borrowBook(userId, bookId);
    assert.ok(first.ok);

    // Bypass the application path entirely and insert a second active loan.
    await assert.rejects(
      () =>
        db.insert(borrowings).values({
          userId,
          bookId,
          dueDate: "2099-01-01",
          status: "borrowed",
        }),
      (error: unknown) => {
        const pg = pgErrorOf(error);
        assert.equal(pg?.code, "23505", "should be a unique_violation");
        assert.equal(pg?.constraint, "borrowings_one_active_loan_per_user_book");
        return true;
      }
    );

    console.log("  -> raw INSERT rejected by borrowings_one_active_loan_per_user_book");
  });

  test("a user may borrow the same book again after returning it", async () => {
    const first = await borrowBook(userId, bookId);
    assert.ok(first.ok);
    const returned = await returnBook(userId, first.borrowingId);
    assert.ok(returned.ok);

    const second = await borrowBook(userId, bookId);
    assert.ok(second.ok, "the partial index must not block a fresh loan after return");
    assert.equal(await availableCopies(bookId), 4);
  });
});

describe("return is symmetric and idempotent", () => {
  let bookId: number;
  let userId: number;
  let borrowingId: number;

  beforeEach(async () => {
    await resetDatabase();
    categoryId = await createCategory("Test Category");
    bookId = await createBook({ title: "One Copy", copies: 1, categoryId });
    [userId] = await createUsers(1);
    const borrowed = await borrowBook(userId, bookId);
    assert.ok(borrowed.ok);
    borrowingId = borrowed.borrowingId;
  });

  test("returning twice in sequence restores exactly one copy", async () => {
    assert.equal(await availableCopies(bookId), 0);

    const first = await returnBook(userId, borrowingId);
    assert.ok(first.ok);
    assert.equal(await availableCopies(bookId), 1);

    const second = await returnBook(userId, borrowingId);
    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.reason, "already_returned");

    const after = await availableCopies(bookId);
    assert.equal(after, 1, "the second return must not inflate the copy count");

    console.log(`  -> 1 of 2 returns succeeded, available ended at ${after} (total_copies is 1)`);
  });

  test(`${CONCURRENCY} concurrent returns of one loan restore exactly one copy`, async () => {
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => returnBook(userId, borrowingId))
    );

    const succeeded = results.filter((r) => r.ok).length;
    assert.equal(succeeded, 1, "exactly one concurrent return should succeed");

    const after = await availableCopies(bookId);
    assert.equal(after, 1, "available_copies must not exceed total_copies");
    assert.equal(await activeLoanCount(bookId), 0);

    console.log(`  -> ${succeeded} of ${CONCURRENCY} returns succeeded, available ended at ${after}`);
  });

  test("returning another user's loan reports not_found and changes nothing", async () => {
    const [otherUser] = await createUsers(1);
    const result = await returnBook(otherUser, borrowingId);

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "not_found");
    assert.equal(await availableCopies(bookId), 0, "the loan must stay open");
  });
});

describe("database-level inventory invariants", () => {
  beforeEach(async () => {
    await resetDatabase();
    categoryId = await createCategory("Test Category");
  });

  test("available_copies cannot be driven negative by a raw UPDATE", async () => {
    const bookId = await createBook({ title: "Guarded", copies: 1, categoryId });

    await assert.rejects(
      () => db.execute(sql`update books set available_copies = -1 where id = ${bookId}`),
      (error: unknown) => {
        const pg = pgErrorOf(error);
        assert.equal(pg?.code, "23514", "should be a check_violation");
        assert.equal(pg?.constraint, "books_available_copies_non_negative");
        return true;
      }
    );

    console.log("  -> raw UPDATE rejected by books_available_copies_non_negative");
  });

  test("available_copies cannot exceed total_copies", async () => {
    const bookId = await createBook({ title: "Guarded Too", copies: 1, categoryId });

    await assert.rejects(
      () => db.execute(sql`update books set available_copies = 2 where id = ${bookId}`),
      (error: unknown) => {
        assert.equal(pgErrorOf(error)?.constraint, "books_available_lte_total");
        return true;
      }
    );

    console.log("  -> raw UPDATE rejected by books_available_lte_total");
  });
});
