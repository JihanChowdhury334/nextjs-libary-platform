import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Stacks — University Library",
    template: "%s — Stacks",
  },
  description:
    "Catalogue search and loan management for a university library: borrow, return, and track due dates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-[var(--color-ground-900)]">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <Navbar />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
