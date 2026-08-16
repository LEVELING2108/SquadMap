import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { createContext } from "@my-better-t-app/api/context";

const handler = async (req: Request) => {
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: async () => await createContext({ req } as any),
      onError({ error, path }) {
        console.error(`tRPC Error on '${path}':`, error);
      },
    });
  } catch (err: any) {
    console.error("Serverless tRPC Request Handler Error:", err);
    return new Response(
      JSON.stringify({ error: { message: err?.message || "Internal Server Error" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export { handler as GET, handler as POST };
