import type { Metadata } from "next";
import { Clock, MapPin, Phone } from "lucide-react";
import { publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";
import { phoneHref } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { ContactForm } from "@/components/content/ContactForm";
import type { CmsPage, StoreItem } from "@/components/content/types";

export const metadata: Metadata = { title: "Контакты" };

export default async function ContactsPage() {
  const [page, stores] = await Promise.all([
    publicGet<CmsPage>("/content/pages/contacts", undefined, 300),
    safe(publicGet<StoreItem[]>("/content/stores", undefined, 300), [] as StoreItem[]),
  ]);

  return (
    <div className="container-page pb-14">
      <Breadcrumbs items={[{ label: "Контакты" }]} />
      <h1>{page.title}</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div>
          <Prose html={page.body_html} />
          <div className="mt-10 rounded-[8px] border border-line bg-white p-6">
            <h2 className="text-xl">Написать нам</h2>
            <p className="mb-5 mt-1 text-sm text-sub">Перезвоним в рабочее время — {SITE.hours}</p>
            <ContactForm />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[8px] border border-line bg-surface text-sub">
            <MapPin className="size-8 text-brand-hover" />
            <span className="text-base font-medium text-ink">Карта проезда</span>
            <span className="text-sm">{SITE.address1}</span>
          </div>
          {stores.map((s) => (
            <div key={s.id} className="rounded-[8px] border border-line bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sub">{s.city}</p>
              <h3 className="mt-0.5">{s.name}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-base">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-sub" aria-hidden />
                  <span>{s.address}</span>
                </li>
                {s.phone ? (
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-sub" aria-hidden />
                    <a href={phoneHref(s.phone)} className="font-medium hover:text-brand-hover">
                      {s.phone}
                    </a>
                  </li>
                ) : null}
                {s.hours ? (
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-sub" aria-hidden />
                    <span>{s.hours}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
          <div className="rounded-[8px] bg-ink p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Режим работы</p>
            <p className="mt-1 text-lg font-semibold">{SITE.hours}</p>
            <a href={SITE.phoneHref} className="mt-3 inline-flex items-center gap-2 text-base font-medium text-brand hover:text-brand-hover">
              <Phone className="size-4" />
              {SITE.phone}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
