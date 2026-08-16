import type { AppRouter } from "@my-better-t-app/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";
import { getClerkAuthToken } from "@/utils/clerk-auth";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // In production browser, use relative /api endpoint or window origin
    return "/api";
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return `${origin}/api`;
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            query.invalidate();
          },
        },
      });
    },
  }),
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: async () => {
        if (typeof window !== "undefined") {
          const token = await getClerkAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        }

        try {
          const { auth } = await import("@clerk/nextjs/server");
          const clerkAuth = await auth();
          const token = await clerkAuth.getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        } catch {
          return {};
        }
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
