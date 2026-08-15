"use client";

import { useAuth } from "@clerk/nextjs";
import { Toaster } from "@my-better-t-app/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";

import { setClerkAuthTokenGetter } from "@/utils/clerk-auth";
import { queryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkApiAuthBridgeInner() {
  try {
    const { getToken } = useAuth();

    useEffect(() => {
      setClerkAuthTokenGetter(getToken);

      return () => {
        setClerkAuthTokenGetter(null);
      };
    }, [getToken]);
  } catch {
    // Suppress error if rendered outside ClerkProvider
  }

  return null;
}

function ClerkApiAuthBridge() {
  if (!hasClerkKey) return null;
  return <ClerkApiAuthBridgeInner />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ClerkApiAuthBridge />
        {children}
        <ReactQueryDevtools />
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
