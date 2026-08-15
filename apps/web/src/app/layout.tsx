import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import "../index.css";
import { Geist, Geist_Mono } from "next/font/google";

import Header from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import PwaInstallBanner from "@/components/PwaInstallBanner";

export const metadata: Metadata = {
  title: "SquadMap — Real-Time Group Location Sharing",
  description: "Track live squad positions, ETAs, and trip destinations without sign-up.",
  manifest: "/manifest.json",
};

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <Providers>
      <div className="min-h-screen bg-stone-50">
        {children}
        <PwaInstallBanner />
      </div>
    </Providers>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#065F46" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {hasClerkKey ? <ClerkProvider>{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}



