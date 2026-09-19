import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body">
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-subtle)]">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="heading-2">Page not found</h1>
          <p className="text-muted max-w-sm">
            That page does not exist, or the item it referred to has been removed
            from the catalogue.
          </p>
          <Link href="/books" className="btn btn-primary mt-2">
            Browse the catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
