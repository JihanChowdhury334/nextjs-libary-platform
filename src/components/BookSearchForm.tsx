"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

type Category = { id: number; name: string };

/**
 * Drives the catalogue query through the URL rather than local state: filtering
 * happens in Postgres, the result is shareable and bookmarkable, and the back
 * button works. The debounce only delays the navigation, not the typing.
 */
export default function BookSearchForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const category = params.get("category") ?? "";
  const firstRender = useRef(true);

  function navigate(next: { search?: string; category?: string }) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    // Any change to the filters invalidates the current page number.
    query.delete("page");
    startTransition(() => router.replace(`/books?${query.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => navigate({ search }), 300);
    return () => clearTimeout(timer);
    // `navigate` closes over router/params, which are stable per render here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <form
      role="search"
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ search });
      }}
    >
      <div className="field flex-1">
        <label htmlFor="catalogue-search" className="field-label sr-only-focusable">
          Search the catalogue
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
            aria-hidden="true"
          />
          <input
            id="catalogue-search"
            type="search"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, ISBN or publisher"
            className="input pl-9"
            autoComplete="off"
          />
          {isPending && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-ink-faint)]"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="field sm:w-56">
        <label htmlFor="catalogue-category" className="field-label sr-only-focusable">
          Filter by category
        </label>
        <select
          id="catalogue-category"
          name="category"
          value={category}
          onChange={(e) => navigate({ category: e.target.value })}
          className="input"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn-secondary sm:self-end">
        Search
      </button>
      <output aria-live="polite" className="sr-only">
        {isPending ? "Searching" : ""}
      </output>
    </form>
  );
}
