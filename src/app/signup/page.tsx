import Link from "next/link";
import SignUpForm from "@/components/SignUpForm";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="page-shell">
      <div className="page-glow" aria-hidden="true" />
      <div className="page-body mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="heading-2">Create an account</h1>
          <p className="text-muted text-[length:var(--text-small)]">
            Borrowing requires an account. Accounts are created as students.
          </p>
        </header>

        <SignUpForm />

        <p className="text-subtle text-center text-[length:var(--text-small)]">
          Already registered?{" "}
          <Link href="/signin" className="font-semibold text-[var(--color-accent-soft)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
