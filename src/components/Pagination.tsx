import Link from "next/link";

/**
 * Plain links, so pagination works without JavaScript and each page has its own
 * URL. Only a window around the current page is rendered.
 */
export default function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams(params);
    if (target === 1) query.delete("page");
    else query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/books?${qs}` : "/books";
  };

  const window = 2;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= window
  );

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="btn btn-ghost">
          Previous
        </Link>
      )}

      <ul className="flex flex-wrap items-center gap-1">
        {pages.map((p, i) => {
          const gap = i > 0 && p - pages[i - 1] > 1;
          return (
            <li key={p} className="flex items-center gap-1">
              {gap && (
                <span className="text-subtle px-1" aria-hidden="true">
                  …
                </span>
              )}
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={
                  p === page
                    ? "btn btn-secondary min-w-11"
                    : "btn btn-ghost min-w-11"
                }
              >
                {p}
              </Link>
            </li>
          );
        })}
      </ul>

      {page < totalPages && (
        <Link href={href(page + 1)} rel="next" className="btn btn-ghost">
          Next
        </Link>
      )}
    </nav>
  );
}
