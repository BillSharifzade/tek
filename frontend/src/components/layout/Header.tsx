"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CategoryNode } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CatalogMenuButton } from "./CatalogMenu";
import { HeaderActions } from "./HeaderActions";
import { SearchBox } from "./SearchBox";

export function Header({ categories }: { categories: CategoryNode[] }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setCompact(window.scrollY > 120);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--header-offset", compact ? "64px" : "116px");
  }, [compact]);

  return (
    <header className={cn("sticky top-0 z-[80] border-b border-line bg-white transition-shadow", compact && "shadow-card")}>
      <div className={cn("container-page flex items-center gap-4 transition-[height] duration-200 md:gap-6", compact ? "h-16" : "h-[80px]")}>
        <Link href="/" className="flex shrink-0 items-center" aria-label="ТЭК — на главную">
          <Image
            src="/brand/logo.png"
            alt="ТЭК — Точикэлектрокомплект"
            width={150}
            height={54}
            priority
            className={cn("w-auto transition-[height] duration-200", compact ? "h-9" : "h-[46px] md:h-[54px]")}
            style={{ width: "auto" }}
          />
        </Link>
        <div className="hidden md:block">
          <CatalogMenuButton categories={categories} compact={compact} />
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <SearchBox compact={compact} />
        </div>
        <div className="ml-auto hidden md:block">
          <HeaderActions compact={compact} />
        </div>
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <CatalogMenuButton categories={categories} compact />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBox compact />
      </div>
    </header>
  );
}
