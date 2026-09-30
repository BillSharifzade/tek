"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { TOP_NAV, type NavItem } from "@/lib/site";
import { useClickOutside, useEscape } from "@/lib/hooks";
import { IconCaret } from "@/components/icons/figma";
import { cn } from "@/lib/cn";

const itemCls = "text-[14px] font-medium leading-[12px] text-sub link-hover whitespace-nowrap";

function Dropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useClickOutside(ref, () => setOpen(false), open);
  useEscape(() => setOpen(false), open);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = () => {
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: item.w }} onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("relative block h-[12px] w-full text-left", itemCls, open && "text-black")}
      >
        {item.label}
        <IconCaret className={cn("absolute right-0 top-[5px] transition-transform", open && "rotate-180")} />
      </button>
      {open && item.children ? (
        <div className="absolute left-[-16px] top-full z-[90] pt-[10px]">
          <ul role="menu" className="min-w-[240px] rounded-[6px] bg-white py-[8px] shadow-pop animate-fade-in">
            {item.children.map((c) => (
              <li key={c.href + c.label} role="none">
                <Link
                  role="menuitem"
                  href={c.href}
                  onClick={() => setOpen(false)}
                  className="block px-[16px] py-[9px] text-[14px] leading-[18px] text-g333 transition-colors hover:bg-surface hover:text-black"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function HeaderNav() {
  return (
    <nav aria-label="Разделы сайта" className="flex items-start gap-[25px]">
      {TOP_NAV.map((item) =>
        item.children ? (
          <Dropdown key={item.label} item={item} />
        ) : (
          <Link key={item.label} href={item.href} className={cn("shrink-0", itemCls)} style={{ width: item.w }}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
