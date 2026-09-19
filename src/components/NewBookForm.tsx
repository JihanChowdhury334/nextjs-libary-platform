"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { postJson } from "@/lib/client";

type Category = { id: number; name: string };

const FIELDS = [
  { name: "title", label: "Title", type: "text", required: true, span: 2 },
  { name: "author", label: "Author", type: "text", required: true, span: 2 },
  { name: "isbn", label: "ISBN", type: "text", required: false, span: 1 },
  { name: "publisher", label: "Publisher", type: "text", required: false, span: 1 },
  { name: "publicationYear", label: "Publication year", type: "number", required: false, span: 1 },
  { name: "totalCopies", label: "Number of copies", type: "number", required: true, span: 1 },
  { name: "location", label: "Shelf location", type: "text", required: false, span: 1 },
] as const;

export default function NewBookForm({ categories }: { categories: Category[] }) {
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
    const payload = Object.fromEntries(form.entries());

    const result = await postJson<{ book: { id: number } }>("/api/books", payload);

    if (result.ok) {
      router.push(`/books/${result.data.book.id}`);
      router.refresh();
      return;
    }

    setSubmitting(false);
    // The API returns per-field messages; show them next to the inputs rather
    // than as one opaque banner.
    if (result.details) setFieldErrors(result.details);
    setFormError(result.details ? null : result.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-6">
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const error = fieldErrors[field.name];
          return (
            <div
              key={field.name}
              className={`field ${field.span === 2 ? "sm:col-span-2" : ""}`}
            >
              <label htmlFor={field.name} className="field-label">
                {field.label}
                {field.required && (
                  <span className="text-[var(--color-danger)]" aria-hidden="true">
                    {" "}
                    *
                  </span>
                )}
                {field.required && <span className="sr-only"> (required)</span>}
              </label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                required={field.required}
                min={field.type === "number" ? 1 : undefined}
                className="input"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${field.name}-error` : undefined}
              />
              {error && (
                <p id={`${field.name}-error`} className="field-error">
                  {error}
                </p>
              )}
            </div>
          );
        })}

        <div className="field">
          <label htmlFor="categoryId" className="field-label">
            Category
          </label>
          <select id="categoryId" name="categoryId" className="input">
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <p className="field-error">{fieldErrors.categoryId}</p>
          )}
        </div>

        <div className="field sm:col-span-2">
          <label htmlFor="description" className="field-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="input"
            aria-invalid={fieldErrors.description ? true : undefined}
          />
          {fieldErrors.description && (
            <p className="field-error">{fieldErrors.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href="/books" className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Adding…" : "Add book"}
        </button>
      </div>
    </form>
  );
}
