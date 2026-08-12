import { protectedProcedure, publicProcedure, router } from "../index";
import { sessionRouter } from "./session";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  session: sessionRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      userId: ctx.auth.userId,
    };
  }),
});
export type AppRouter = typeof appRouter;

