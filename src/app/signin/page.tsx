import { Suspense } from "react";
import Link from "next/link";
import SignInForm from "@/components/SignInForm";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="heading-2">Sign in</h1>
          <p className="text-muted text-[length:var(--text-small)]">
            Use the email and password you registered with.
          </p>
        </header>

        <Suspense fallback={<div className="skeleton h-72 w-full" />}>
          <SignInForm />
        </Suspense>

        <p className="text-subtle text-center text-[length:var(--text-small)]">
          No account?{" "}
          <Link href="/signup" className="font-semibold text-[var(--color-accent-soft)]">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
