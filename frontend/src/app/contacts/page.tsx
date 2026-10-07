import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";
import { phoneHref } from "@/lib/format";
import { IconPin } from "@/components/icons/figma";
import { FacebookIcon, InstagramIcon, YoutubeIcon } from "@/components/ui/SocialIcons";
import { PageHead, SectionTitle } from "@/components/content/PageHead";
import { ContactForm } from "@/components/content/ContactForm";
import { IconArrowSmall } from "@/components/content/icons";
import { SOCIAL_LINKS } from "@/components/content/company";
import { StaticMap, yandexMapsHref } from "@/components/content/StaticMap";
import type { CmsPage, StoreItem } from "@/components/content/types";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Контакты",
  description: `Адреса, телефоны и режим работы ТЭК в Душанбе и Худжанде. ${SITE.phone}, ${SITE.email}.`,
};

/** «Показать на карте»: по координатам магазина из API, без них — поиск адреса на Яндекс.Картах. */
function mapLink(s: StoreItem): string {
  return s.lat != null && s.lon != null ? yandexMapsHref(s.lat, s.lon) : `https://yandex.ru/maps/?text=${encodeURIComponent(s.address)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] leading-[18px] text-muted">{label}</p>
      <div className="mt-[4px]">{children}</div>
    </div>
  );
}

const socials = [
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.youtube, label: "YouTube", Icon: YoutubeIcon },
];

export default async function ContactsPage() {
  const [page, stores] = await Promise.all([
    safe(publicGet<CmsPage>("/content/pages/contacts", undefined, 300), null),
    safe(publicGet<StoreItem[]>("/content/stores", undefined, 300), [] as StoreItem[]),
  ]);

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Контакты" }]} title={page?.title ?? "Контакты"} />

      {/* Главный офис + карта: серая плашка r11 и карта справа, как первый экран «Сервис центр ДГУ» */}
      <section className="mt-[24px] grid overflow-hidden rounded-[11px] bg-surface-2 md:mt-[32px] lg:grid-cols-[440px_minmax(0,1fr)]">
        <div className="flex flex-col px-[20px] py-[28px] md:px-[40px] md:py-[40px]">
          <p className="text-[13px] leading-[18px] text-muted">Главный офис</p>
          <h2 className="mt-[6px] text-[20px] font-bold leading-[26px] md:text-[22px] md:leading-[28px]">{SITE.address1}</h2>

          <div className="mt-[28px] flex flex-col gap-[20px]">
            <Row label="Телефон">
              <a href={SITE.phoneHref} className="link-hover block text-[20px] font-bold leading-[24px] tnum">
                {SITE.phone}
              </a>
            </Row>
            <Row label="Электронная почта">
              <p className="flex flex-wrap gap-x-[20px] gap-y-1 text-[16px] leading-[22px]">
                <a href={`mailto:${SITE.email}`} className="text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
                  {SITE.email}
                </a>
                <a href={`mailto:${SITE.salesEmail}`} className="text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
                  {SITE.salesEmail}
                </a>
              </p>
            </Row>
            <Row label="Режим работы">
              <p className="text-[16px] leading-[22px] text-g333">{SITE.hoursFull}</p>
            </Row>
          </div>

          <div className="mt-[28px] flex items-center gap-[10px] lg:mt-auto lg:pt-[28px]">
            {socials.map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-[40px] items-center justify-center rounded-full bg-white text-g333 transition-colors hover:bg-btn-hover hover:text-black">
                <Icon className="size-[18px]" />
              </a>
            ))}
            <a href="#feedback" className="ml-auto inline-flex h-[40px] items-center rounded-[7px] bg-brand px-[18px] text-[14px] font-medium text-black transition-colors hover:bg-brand-hover">
              Написать нам
            </a>
          </div>
        </div>
        <StaticMap lat={SITE.officeCoords[0]} lon={SITE.officeCoords[1]} title={`Главный офис ТЭК на карте: ${SITE.address1}`} className="h-[320px] md:h-[420px] lg:h-auto lg:min-h-[480px]" />
      </section>

      {/* Магазины и филиалы */}
      {stores.length > 0 ? (
        <section className="mt-[56px] md:mt-[90px]">
          <SectionTitle>Магазины и филиалы</SectionTitle>
          <p className="mt-[12px] max-w-[860px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
            Обратитесь в ближайший офис для консультации, самовывоза заказа или оформления документов.
          </p>
          <ul className="mt-[24px] grid grid-cols-1 gap-[13px] md:mt-[28px] md:grid-cols-2 lg:grid-cols-3 lg:gap-[20px]">
            {stores.map((s) => (
              <li key={s.id} className="flex flex-col rounded-[11px] bg-surface-2 px-[24px] pb-[24px] pt-[22px] md:px-[28px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-[24px] items-center rounded-[15px] bg-white px-[11px] text-[13px] leading-[18px] text-g333">{s.city}</span>
                  {s.delivery_hint ? <span className="text-[13px] leading-[18px] text-success">Самовывоз {s.delivery_hint}</span> : null}
                </div>
                <h3 className="mt-[14px] text-[18px] font-bold leading-[24px]">{s.name}</h3>
                <p className="mt-[8px] flex items-start gap-[6px] text-[14px] leading-[20px] text-sub">
                  <IconPin className="mt-[2px] shrink-0 text-muted" />
                  {s.address}
                </p>
                <dl className="mt-[16px] flex flex-col gap-[8px] border-t border-line-3 pt-[16px] text-[14px] leading-[20px]">
                  {s.phone ? (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Телефон</dt>
                      <dd>
                        <a href={phoneHref(s.phone)} className="link-hover font-medium tnum">
                          {s.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {s.hours ? (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">Режим работы</dt>
                      <dd className="text-right text-g333">{s.hours}</dd>
                    </div>
                  ) : null}
                </dl>
                <a href={mapLink(s)} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-[5px] self-start pt-[18px] text-[14px] leading-[20px] text-g333 underline underline-offset-[3px] transition-colors hover:text-black">
                  Показать на карте
                  <IconArrowSmall className="size-[11px]" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Обратная связь — форма как «Оставьте заявку» (10972:2084) + карточка реквизитов как прайс-карта ДГУ */}
      <section id="feedback" className="mt-[56px] grid scroll-mt-[130px] grid-cols-1 gap-[40px] md:mt-[90px] lg:grid-cols-[minmax(0,584px)_417px] lg:justify-between">
        <div>
          <h2 className="text-[26px] font-bold leading-[32px] md:text-[32px] md:leading-[36px]">Обратная связь</h2>
          <p className="mt-[14px] text-[16px] leading-[24px] text-g333 md:text-[18px]">Оставьте вопрос, и наши специалисты свяжутся с вами в рабочее время.</p>
          <ContactForm withEmail withConsent messagePlaceholder="Ваш вопрос" submitLabel="Отправить" className="mt-[25px]" />
        </div>
        <aside className="self-start rounded-[10px] bg-white px-[24px] py-[28px] shadow-card md:px-[34px] md:py-[34px]">
          <h3 className="text-[16px] font-semibold leading-[20px] text-g333">Реквизиты</h3>
          <dl className="mt-[10px] text-[15px] leading-[20px]">
            {[
              ["Компания", SITE.company],
              ["Юр. адрес", SITE.legalAddress],
              ["Отдел продаж", SITE.salesEmail],
              ["Общие вопросы", SITE.email],
              ["Телефон", SITE.phone],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 border-b border-outline py-[10px]">
                <dt className="shrink-0 text-sub">{k}</dt>
                <dd className="text-right font-semibold text-g333">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-[18px] rounded-[7px] bg-[#F4EFFE] px-[20px] py-[14px] text-[14px] leading-[22px] text-[#313033]">
            Для юридических лиц: счёт на оплату и закрывающие документы — в{" "}
            <Link href="/account/documents" className="font-semibold underline underline-offset-2 hover:text-black">
              личном кабинете
            </Link>
            .
          </div>
        </aside>
      </section>
    </div>
  );
}
