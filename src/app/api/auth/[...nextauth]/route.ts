import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// A route module may only export route handlers, so authOptions lives in
// src/lib/auth.ts and is imported by everything that needs it.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
