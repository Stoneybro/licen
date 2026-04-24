"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !authenticated) {
      const query = window.location.search.replace("?", "");
      const returnTo = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [ready, authenticated, pathname, router]);

  if (!ready) {
    return <div className="min-h-svh bg-background" />;
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
