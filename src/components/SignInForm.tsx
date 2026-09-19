"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only same-site paths are honoured, so a crafted ?callbackUrl= cannot send a
  // signed-in user off to another origin.
  const raw = params.get("callbackUrl") ?? "/books";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/books";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      redirect: false,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (result?.ok) {
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    setSubmitting(false);
    // Deliberately does not say which of the two was wrong.
    setError("That email and password combination was not recognised.");
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-5">
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          aria-invalid={error ? true : undefined}
        />
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
