"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Last line of defence for the UI. A visitor sees a sentence and a way out; the
 * digest is shown so a report can be matched to a server log line, and the
 * message itself is never rendered.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body">
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 py-14 text-center" role="alert">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="heading-2">Something went wrong</h1>
          <p className="text-muted max-w-sm">
            This page could not be loaded. The error has been logged.
          </p>
          {error.digest && (
            <p className="text-subtle font-mono text-[length:var(--text-micro)]">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/books" className="btn btn-secondary">
              Back to the catalogue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
