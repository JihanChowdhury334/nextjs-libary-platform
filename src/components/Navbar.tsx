"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { BookOpen, LogOut, Menu, Plus, Settings, User, X } from "lucide-react";
import { STAFF_ROLES } from "@/lib/roles";

type NavLink = { href: string; label: string; icon: typeof BookOpen };

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Route changes should not leave the mobile menu hanging open.
  useEffect(() => setMenuOpen(false), [pathname]);

  const isStaff =
    session?.user?.role !== undefined && STAFF_ROLES.includes(session.user.role);

  const links: NavLink[] = [
    { href: "/books", label: "Catalogue", icon: BookOpen },
    ...(session ? [{ href: "/my-books", label: "My loans", icon: User }] : []),
    ...(isStaff
      ? [
          { href: "/books/new", label: "Add book", icon: Plus },
          { href: "/admin", label: "Admin", icon: Settings },
        ]
      : []),
  ];

  const linkClass = (href: string) =>
    [
      "inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5",
      "text-[length:var(--text-small)] font-medium transition-colors",
      pathname === href || pathname.startsWith(`${href}/`)
        ? "text-[var(--color-ink)]"
        : "text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]",
    ].join(" ");

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-edge)] bg-[var(--color-ground-900)]/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-[length:var(--text-lead)] font-semibold tracking-tight text-[var(--color-ink)]"
          >
            Stacks
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={linkClass(href)}
                  aria-current={pathname === href ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <div className="skeleton h-9 w-28" aria-hidden="true" />
          ) : session ? (
            <>
              <span className="text-subtle hidden text-[length:var(--text-small)] sm:inline">
                {session.user?.email}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn btn-ghost"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </>
          ) : (
            // Below `sm` these two would crowd the menu button, so they move
            // into the drawer instead.
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/signin" className="btn btn-ghost">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Create account
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="btn btn-ghost md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-nav" className="border-t border-[var(--color-edge)] md:hidden">
          <ul className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`${linkClass(href)} w-full py-2.5`}
                  aria-current={pathname === href ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}

            {!session && status !== "loading" && (
              <li className="mt-2 flex flex-col gap-2 border-t border-[var(--color-edge)] pt-3 sm:hidden">
                <Link href="/signin" className="btn btn-secondary w-full">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary w-full">
                  Create account
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
