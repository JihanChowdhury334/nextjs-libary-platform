import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseBookQuery,
  parseBorrow,
  parseNewBook,
  parseSignup,
  toPositiveInt,
} from "@/lib/validation";
import { escapeLike } from "@/lib/books";

describe("input validation", () => {
  test("rejects non-integer and hostile book ids", () => {
    for (const bad of [undefined, null, "abc", -1, 0, 1.5, "1; drop table books", [1], {}]) {
      assert.equal(parseBorrow({ bookId: bad }).ok, false, `should reject ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(parseBorrow({ bookId: 7 }), { ok: true, value: { bookId: 7 } });
    assert.deepEqual(parseBorrow({ bookId: "7" }), { ok: true, value: { bookId: 7 } });
  });

  test("rejects a body that is not an object", () => {
    assert.equal(parseBorrow("nope").ok, false);
    assert.equal(parseBorrow([1, 2]).ok, false);
    assert.equal(parseBorrow(null).ok, false);
  });

  test("toPositiveInt refuses values that lose precision", () => {
    assert.equal(toPositiveInt("9007199254740993"), null);
    assert.equal(toPositiveInt(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  });

  test("new book requires a title, an author and a copy count", () => {
    const result = parseNewBook({ title: "  ", author: "", totalCopies: 0 });
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.errors.title);
    assert.ok(result.ok === false && result.errors.author);
    assert.ok(result.ok === false && result.errors.totalCopies);
  });

  test("new book trims strings and normalises blanks to null", () => {
    const result = parseNewBook({
      title: "  Dune  ",
      author: " Frank Herbert ",
      isbn: "",
      publisher: "   ",
      totalCopies: "3",
    });
    assert.ok(result.ok);
    assert.equal(result.value.title, "Dune");
    assert.equal(result.value.author, "Frank Herbert");
    assert.equal(result.value.isbn, null);
    assert.equal(result.value.publisher, null);
    assert.equal(result.value.totalCopies, 3);
  });

  test("new book rejects a publication year in the far future", () => {
    const result = parseNewBook({ title: "T", author: "A", totalCopies: 1, publicationYear: 3000 });
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.errors.publicationYear);
  });

  test("new book has no availableCopies field for a client to set", () => {
    const result = parseNewBook({
      title: "T",
      author: "A",
      totalCopies: 1,
      availableCopies: 9999,
    });
    assert.ok(result.ok);
    assert.equal("availableCopies" in result.value, false);
  });

  test("signup normalises email and enforces a password floor", () => {
    const short = parseSignup({ name: "A", email: "a@b.co", password: "short" });
    assert.equal(short.ok, false);

    const ok = parseSignup({ name: " Ada ", email: "  ADA@Example.COM ", password: "correct horse" });
    assert.ok(ok.ok);
    assert.equal(ok.value.email, "ada@example.com");
    assert.equal(ok.value.name, "Ada");
  });

  test("signup rejects a password longer than bcrypt reads", () => {
    const result = parseSignup({ name: "A", email: "a@b.co", password: "x".repeat(73) });
    assert.equal(result.ok, false);
  });

  test("browse query clamps page size and ignores junk", () => {
    const q = parseBookQuery(
      new URLSearchParams({ limit: "10000", page: "-3", category: "abc", search: "x".repeat(500) })
    );
    assert.equal(q.limit, 50);
    assert.equal(q.page, 1);
    assert.equal(q.categoryId, null);
    assert.equal(q.search.length, 100);
  });

  test("LIKE wildcards typed by a user are escaped, not executed", () => {
    assert.equal(escapeLike("100%"), "100\\%");
    assert.equal(escapeLike("a_b"), "a\\_b");
    assert.equal(escapeLike("back\\slash"), "back\\\\slash");
  });
});
