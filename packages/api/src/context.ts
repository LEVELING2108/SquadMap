type ClerkContextAuth = {
  userId: string | null;
};

type ClerkRequestContext = {
  auth: ClerkContextAuth | null;
  session: null;
};

function toClerkContextAuth(auth: { userId: string | null } | null): ClerkContextAuth | null {
  return auth ? { userId: auth.userId } : null;
}

import { getAuth } from "@clerk/express";

export async function createContext(
  opts: any,
): Promise<ClerkRequestContext> {
  let clerkAuth: ClerkContextAuth | null = null;
  try {
    if (opts?.req && typeof opts.req.header === "function") {
      const rawAuth = getAuth(opts.req);
      clerkAuth = toClerkContextAuth(rawAuth);
    }
  } catch {
    clerkAuth = null;
  }
  return {
    auth: clerkAuth,
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
