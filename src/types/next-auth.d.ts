import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

// The credentials provider puts the database id and role on the token; without
// this augmentation every `session.user.id` read is an `any` cast.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
  }
}
