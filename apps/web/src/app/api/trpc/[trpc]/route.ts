import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { createContext } from "@my-better-t-app/api/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req } as any),
  });

export { handler as GET, handler as POST };
