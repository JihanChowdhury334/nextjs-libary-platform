import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isRole, type Role } from "@/lib/roles";

export { ROLES, STAFF_ROLES, isRole } from "@/lib/roles";
export type { Role } from "@/lib/roles";


export const authOptions: NextAuthOptions = {
  // No adapter: this app authenticates against its own `users` table with a
  // credentials provider, and credentials sessions are JWT-only. Wiring the
  // Drizzle adapter in adds account/session tables that are never written.
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.trim().toLowerCase()))
          .limit(1);

        const user = result[0];
        // Compare against a dummy hash when the user is missing so that a
        // wrong email and a wrong password take the same amount of time.
        const hash = user?.password ?? DUMMY_HASH;
        const valid = await bcrypt.compare(credentials.password, hash);
        if (!user || !valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: isRole(user.role) ? user.role : "student",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid ?? token.sub ?? "";
      session.user.role = isRole(token.role) ? token.role : "student";
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};

// bcrypt hash of a value no one can supply; used only to equalise timing.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8i1lJ0Yt9sHSlTgCNvQKTM6jFBDN5e";

export type SessionUser = { id: number; role: Role; email: string | null };

/** Current user, or null when the request carries no valid session. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const rawId = session?.user?.id;
  if (!rawId) return null;

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    role: isRole(session?.user?.role) ? session.user.role : "student",
    email: session?.user?.email ?? null,
  };
}

export function hasRole(user: SessionUser | null, allowed: readonly Role[]): boolean {
  return user !== null && allowed.includes(user.role);
}
