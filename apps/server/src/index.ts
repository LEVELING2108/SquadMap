import { clerkMiddleware } from "@clerk/express";
import { createContext } from "@my-better-t-app/api/context";
import { appRouter } from "@my-better-t-app/api/routers/index";
import { env } from "@my-better-t-app/env/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use((req, res, next) => {
  try {
    if (
      env.CLERK_PUBLISHABLE_KEY &&
      env.CLERK_PUBLISHABLE_KEY !== "pk_test_placeholder" &&
      env.CLERK_SECRET_KEY &&
      env.CLERK_SECRET_KEY !== "sk_test_placeholder"
    ) {
      return clerkMiddleware()(req, res, next);
    }
  } catch {
    // Skip clerk middleware in local keyless dev mode
  }
  next();
});




app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
