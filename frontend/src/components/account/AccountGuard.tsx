"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { Skeleton } from "@/components/ui/Skeleton";

/** Client-side gate for the account area: waits for auth hydration, redirects guests to /login. */
export function AccountGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);

  if (!hydrated) return <AccountSkeleton />;
  if (!user) return null;
  return <>{children}</>;
}

export function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start lg:gap-[28px]" aria-busy>
      <Skeleton className="h-[48px] rounded-[10px] lg:h-[505px] lg:w-[246px] lg:shrink-0" />
      <Skeleton className="h-[347px] flex-1 rounded-[10px]" />
    </div>
  );
}
