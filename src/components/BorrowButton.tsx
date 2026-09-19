"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookMarked, Check, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { postJson } from "@/lib/client";

/**
 * Borrowing is a mutation, so its outcome is reported inline rather than through
 * a window.alert(), and the button carries its own pending/success/error state.
 */
export default function BorrowButton({
  bookId,
  available,
  className = "btn btn-primary",
}: {
  bookId: number;
  available: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { status } = useSession();
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!available && state !== "done") {
    return (
      <span className="chip chip-danger" role="status">
        All copies on loan
      </span>
    );
  }

  if (status === "unauthenticated") {
    return (
      <a href={`/signin?callbackUrl=/books/${bookId}`} className={className}>
        Sign in to borrow
      </a>
    );
  }

  async function borrow() {
    setState("pending");
    setError(null);

    const result = await postJson<{ dueDate: string }>("/api/borrow", { bookId });

    if (result.ok) {
      setState("done");
      router.refresh();
      return;
    }

    setState("idle");
    setError(result.message);
    // The server is the source of truth for availability; if it disagrees with
    // what this page rendered, re-fetch rather than leaving a stale count.
    if (result.code === "unavailable" || result.code === "already_borrowed") {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={borrow}
        disabled={state !== "idle"}
        className={className}
      >
        {state === "pending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {state === "done" && <Check className="h-4 w-4" aria-hidden="true" />}
        {state === "idle" && <BookMarked className="h-4 w-4" aria-hidden="true" />}
        {state === "pending" ? "Borrowing…" : state === "done" ? "Borrowed" : "Borrow"}
      </button>

      <p aria-live="polite" className="min-h-0">
        {state === "done" && (
          <span className="text-[length:var(--text-micro)] text-[var(--color-ok)]">
            Added to your loans.
          </span>
        )}
        {error && <span className="field-error">{error}</span>}
      </p>
    </div>
  );
}
