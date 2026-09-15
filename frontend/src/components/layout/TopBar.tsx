import Link from "next/link";
import { Phone } from "lucide-react";
import { SITE, TOP_NAV } from "@/lib/site";
import { CitySelect } from "./CitySelect";

export function TopBar() {
  return (
    <div className="hidden bg-surface text-sm text-ink md:block">
      <div className="container-page flex h-9 items-center justify-between">
        <nav aria-label="Информация" className="flex items-center gap-6">
          {TOP_NAV.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-sub">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6">
          <a href={SITE.phoneHref} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-sub">
            <Phone className="size-3.5 text-brand" fill="currentColor" strokeWidth={0} />
            {SITE.phoneShort}
          </a>
          <CitySelect />
        </div>
      </div>
    </div>
  );
}
