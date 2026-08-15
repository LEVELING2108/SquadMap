"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function Dashboard() {
  if (!hasClerkKey) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-600">Guest Mode (Zero Sign-up)</p>
      </div>
    );
  }

  return <DashboardInner />;
}

function DashboardInner() {
  const user = useUser();
  const nameFromParts = [user.user?.firstName, user.user?.lastName].filter(Boolean).join(" ");
  const displayName =
    user.user?.fullName ||
    nameFromParts ||
    user.user?.username ||
    user.user?.primaryEmailAddress?.emailAddress ||
    user.user?.primaryPhoneNumber?.phoneNumber ||
    "User";
  const privateData = useQuery({
    ...trpc.privateData.queryOptions(),
    enabled: user.isLoaded && !!user.user,
  });

  if (!user.isLoaded) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user.user) {
    return (
      <div className="p-6">
        <SignInButton />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Welcome {displayName}</p>
      <p>API: {privateData.data?.message}</p>
      <UserButton />
    </div>
  );
}
