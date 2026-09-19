import Link from "next/link";

const REPO = "https://github.com/JihanChowdhury334/nextjs-libary-platform";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-edge)] bg-[var(--color-ground-900)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[length:var(--text-small)] font-semibold text-[var(--color-ink)]">
            Stacks
          </p>
          <p className="text-subtle text-[length:var(--text-micro)]">
            University library catalogue and loan management.
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--text-small)]">
            <li>
              <Link href="/books" className="text-subtle hover:text-[var(--color-ink)]">
                Catalogue
              </Link>
            </li>
            <li>
              <a
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="text-subtle hover:text-[var(--color-ink)]"
              >
                Source
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/jihan-chowdhury-aa6506292/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-subtle hover:text-[var(--color-ink)]"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
