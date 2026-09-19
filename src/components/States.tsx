import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

/**
 * Every data-fetching view in the app renders one of these three when it has no
 * content to show, so a visitor never lands on a blank screen or a raw stack
 * trace.
 */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-subtle)]">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h2 className="heading-3">{title}</h2>
      <p className="text-muted max-w-sm text-[length:var(--text-small)]">{body}</p>
      {action && (
        <Link href={action.href} className="btn btn-secondary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="heading-3">{title}</h2>
      <p className="text-muted max-w-sm text-[length:var(--text-small)]">{body}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

/** Shape-matched placeholder for the book list, so the layout does not jump. */
export function BookListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="grid gap-4" aria-busy="true" aria-label="Loading books">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="card">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton mt-3 h-4 w-1/3" />
          <div className="skeleton mt-4 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-4/5" />
        </li>
      ))}
    </ul>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-tight">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-3 h-7 w-14" />
        </div>
      ))}
    </div>
  );
}
