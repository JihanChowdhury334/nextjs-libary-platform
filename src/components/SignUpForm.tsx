"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postJson } from "@/lib/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

export default function SignUpForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await postJson("/api/signup", {
      name: String(form.get("name") ?? ""),
      email,
      password,
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.details) setFieldErrors(result.details);
      else setFormError(result.message);
      return;
    }

    // Sign straight in rather than bouncing the user to a second form.
    const signedIn = await signIn("credentials", { redirect: false, email, password });
    setSubmitting(false);

    if (signedIn?.ok) {
      router.push("/books");
      router.refresh();
    } else {
      router.push("/signin");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5">
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="field">
        <label htmlFor="name" className="field-label">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="input"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" className="field-error">
            {fieldErrors.name}
          </p>
        )}
      </div>

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
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="field-error">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="input"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
        />
        {fieldErrors.password ? (
          <p id="password-error" className="field-error">
            {fieldErrors.password}
          </p>
        ) : (
          <p id="password-hint" className="field-hint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
