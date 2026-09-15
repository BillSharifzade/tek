import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, YoutubeIcon } from "@/components/ui/SocialIcons";
import type { CategoryNode } from "@/lib/types";
import { FOOTER_COMPANY, FOOTER_CUSTOMERS, SITE } from "@/lib/site";

export function Footer({ categories }: { categories: CategoryNode[] }) {
  return (
    <footer className="mt-14 bg-ink text-white">
      <div className="container-page grid grid-cols-1 gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div>
          <h4 className="mb-4 text-md font-semibold">Каталог</h4>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {categories.slice(0, 10).map((c) => (
              <li key={c.slug}>
                <Link href={`/catalog/${c.slug}`} className="transition-colors hover:text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-md font-semibold">Компания</h4>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {FOOTER_COMPANY.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-md font-semibold">Покупателям</h4>
          <ul className="flex flex-col gap-2 text-sm text-white/70">
            {FOOTER_CUSTOMERS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-md font-semibold">Контакты</h4>
          <ul className="flex flex-col gap-3 text-sm text-white/80">
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="flex flex-col">
                <a href={SITE.phoneHref} className="text-lg font-semibold text-white hover:text-brand">
                  {SITE.phone}
                </a>
                <a href={SITE.phone2Href} className="hover:text-brand">
                  {SITE.phone2}
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand" />
              <a href={`mailto:${SITE.email}`} className="hover:text-brand">
                {SITE.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="flex flex-col gap-1">
                <span>{SITE.address1}</span>
                <span className="text-white/60">{SITE.address2}</span>
              </span>
            </li>
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <a href={SITE.socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex size-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-brand hover:text-ink">
              <FacebookIcon className="size-4" />
            </a>
            <a href={SITE.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex size-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-brand hover:text-ink">
              <InstagramIcon className="size-4" />
            </a>
            <a href={SITE.socials.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex size-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-brand hover:text-ink">
              <YoutubeIcon className="size-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-5 text-sm text-white/60 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-8 items-center rounded-[6px] bg-white px-2">
              <Image src="/brand/logo.png" alt="ТЭК" width={72} height={26} className="h-[26px] w-auto" />
            </span>
            <span>© {new Date().getFullYear()} {SITE.company}. Все права защищены.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Русский</span>
            <span className="text-white/30">English</span>
            <span className="text-white/30">Тоҷикӣ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
