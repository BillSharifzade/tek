import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Product, QuestionsResponse, ReviewsResponse } from "@/lib/types";
import { optional, personalizedGet, publicGet, safe } from "@/lib/server";
import { Stars, pluralReviews } from "@/components/ui/Rating";
import { BuyProvider } from "@/components/product/BuyContext";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox, PromoPlaque } from "@/components/product/BuyBox";
import { Pickup } from "@/components/product/Pickup";
import { OfferSelector } from "@/components/product/OfferSelector";
import { OfferScope } from "@/components/product/OfferScope";
import { SpecRows } from "@/components/product/Specs";
import { ProductTabsBar } from "@/components/product/ProductTabsBar";
import { Features } from "@/components/product/Features";
import { BrandCard, ServicesCard } from "@/components/product/ProductAside";
import { Documents } from "@/components/product/Documents";
import { ProductAccessories } from "@/components/product/ProductAccessories";
import { Reviews } from "@/components/product/Reviews";
import { Questions } from "@/components/product/Questions";
import { IconChevronSmall, IconPack } from "@/components/product/icons";
import { cn } from "@/lib/cn";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await optional(publicGet<Product>(`/catalog/products/${slug}`));
  return p ? { title: `${p.name} — купить, код ${p.code}`, description: p.short_description || p.description?.slice(0, 160) } : { title: "Товар" };
}

const EMPTY_REVIEWS: ReviewsResponse = { summary: { avg: 0, count: 0, distribution: {} }, items: [], page: 1, pages: 1 };
const EMPTY_QUESTIONS: QuestionsResponse = { items: [], total: 0 };

/** Заголовок секции 25/21 600 (Figma «Комплектующие», «Отзывы», «Вопросы и ответы»). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[25px] font-semibold leading-[21px] text-black">{children}</h2>;
}

/**
 * Страница товара — 1:1 с фреймом Figma «Карта продукта» (8612:150), 1512 шириной.
 * Верх: крошки, H1, преимущество; три колонки: галерея 530 / предложения + характеристики 334 / цена 292.
 * Ниже — сегмент-табы (при прокрутке прилипают вместе с полосой товара, 10444:276) и секции.
 */
export default async function ProductRoute({ params }: Props) {
  const { slug } = await params;
  const [product, reviews, questions] = await Promise.all([
    optional(personalizedGet<Product>(`/catalog/products/${slug}`)),
    // отзывы и вопросы — без кеша Next: только что оставленный отзыв виден сразу (API кеширует и сбрасывает сам)
    safe(publicGet<ReviewsResponse>(`/catalog/products/${slug}/reviews`, undefined, 0), EMPTY_REVIEWS),
    safe(publicGet<QuestionsResponse>(`/catalog/products/${slug}/questions`, undefined, 0), EMPTY_QUESTIONS),
  ]);
  if (!product) notFound();

  const reviewsCount = reviews.summary.count || product.reviews_count;
  const tabs = [
    { id: "specs", label: "Характеристики" },
    { id: "accessories", label: "Комплектующие" },
    { id: "reviews", label: "Отзывы", count: reviewsCount },
    { id: "questions", label: "Вопросы", count: questions.total || product.questions_count },
  ];
  const images = product.images.length > 0 ? product.images : product.image ? [product.image] : [];
  const shortSpecs = product.attributes.slice(0, 8);
  const half = Math.ceil(product.attributes.length / 2);
  const specCols = [product.attributes.slice(0, half), product.attributes.slice(half)].filter((c) => c.length > 0);
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <BuyProvider product={product}>
      <div className="container-page pb-16 lg:pb-[186px]">
        {/* крошки: 14/15 #808080, «>» с отступами 11px */}
        <nav aria-label="Хлебные крошки" className="pt-6 text-[14px] leading-[15px] text-muted lg:pt-[43px] xl:pl-[2px]">
          <ol className="flex flex-wrap items-center gap-y-1">
            <li>
              <Link href="/" className="link-hover">
                Главная
              </Link>
            </li>
            {product.breadcrumbs.map((c) => (
              <li key={c.slug} className="flex items-center">
                <span aria-hidden className="px-[11px]">
                  &gt;
                </span>
                <Link href={`/catalog/${c.slug}`} className="link-hover">
                  {c.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {/* всё, что меняется при выборе исполнения: переход между исполнениями — без перезагрузки и прокрутки */}
        <OfferScope>
        <h1 className="offer-dim mt-[12px] text-[22px] font-semibold leading-[28px] text-black lg:mb-[-6.5px] lg:mt-[10.5px] lg:text-[26px] lg:leading-[30px] xl:pl-[2px]">{product.name}</h1>

        {product.short_description ? (
          <p className="mt-[20px] flex items-start text-[14px] font-semibold leading-[15px] text-[#F9AD42] xl:pl-[1.2px]">
            <Image src="/figma/star-2.png" alt="" width={20} height={20} className="relative top-[-1.3px] size-[20px] shrink-0" />
            <span className="relative top-[2.5px] ml-[7.8px]">{product.short_description}</span>
          </p>
        ) : null}

        <div className="mt-[20px] grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-[530px_334px_minmax(0,1fr)] xl:gap-x-[43px] xl:gap-y-0">
          <div className="offer-dim min-w-0">
            <Gallery images={images} name={product.name} badges={product.badges} />
          </div>

          <div className="min-w-0 max-md:order-2">
            <div className="flex h-[15px] items-start xl:pl-px">
              <Stars value={product.rating || 0} size={14.6} step={15.6} className="mt-[0.1px] flex" />
              <a href="#reviews" className="ml-[7px] text-[14px] font-semibold leading-[15px] text-link link-hover">
                {reviewsCount} {pluralReviews(reviewsCount)}
              </a>
              <span className="offer-dim ml-auto text-[14px] leading-[15px] text-sub">Код: {product.code}</span>
            </div>

            <OfferSelector product={product} className="mt-[23px]" />

            {shortSpecs.length > 0 ? (
              <section className={cn("offer-dim", product.variants ? "mt-[36px]" : "mt-[32px]")} aria-label="Основные характеристики">
                {/* Figma: «Описание» на y=638 = низ свотчей 602 + 36; первая строка — базовая линия 691 */}
                <div className="flex items-start justify-between">
                  <h2 className="mt-px text-[20px] font-semibold leading-[20px] text-black xl:ml-[3px]">Характеристики</h2>
                  <a
                    href={paragraphs.length > 0 ? "#description" : "#specs"}
                    className="flex h-[24px] w-[86px] items-start rounded-[5px] bg-btn pl-[8px] pt-[6px] text-[13px] font-medium leading-[12px] text-g333 transition-colors hover:bg-btn-hover"
                  >
                    Описание
                    <IconChevronSmall className="ml-[3px] mt-[1.1px]" />
                  </a>
                </div>
                <SpecRows items={shortSpecs} align="right" labelWidth={138} className="mt-[14px] xl:pl-[2px]" />
              </section>
            ) : null}

            {product.pack ? (
              <div className="mt-[31px] flex h-[55px] w-[201px] items-start rounded-[7px] border border-outline">
                <IconPack className="ml-[16px] mt-[13px] shrink-0" />
                <p className="ml-[14px] mt-[6px] text-[13px] leading-[19px] text-sub">
                  Кратность упаковки:
                  <br />
                  <span className="text-black">{product.pack.label}</span>
                </p>
              </div>
            ) : null}
          </div>

          {/* на телефоне цена и «В корзину» — сразу под фото, а не после характеристик */}
          <div className="offer-dim min-w-0 max-md:order-1 md:col-span-2 xl:col-span-1 xl:ml-auto xl:w-[292px]">
            <PromoPlaque />
            <div className="mt-[14px]">
              <BuyBox product={product} />
            </div>
            <Pickup product={product} className="mt-[39px]" />
          </div>
        </div>
        </OfferScope>

        {/* всё ниже в макете сдвинуто на 1px вправо (127…1387) */}
        <div className="xl:-mr-px xl:ml-px">
          <ProductTabsBar tabs={tabs} product={product} className="mt-10 lg:mt-[46px]" />

          <section id="specs" className="mt-[25px] scroll-mt-[140px] lg:scroll-mt-[287px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,906px)_305px] lg:justify-between lg:gap-0">
            <div className="min-w-0">
              <Features product={product} />
              {paragraphs.length > 0 ? (
                <div id="description" className="mt-[38px] scroll-mt-[140px] lg:scroll-mt-[287px] flex flex-col gap-[6px] text-[15px] leading-[25px] text-black first:mt-0">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              ) : null}
              {specCols.length > 0 ? (
                // Figma: текст 14/25 с y=1490 → базовая линия 1507; у строк 14/21 она на 2px выше, отсюда 34, а не 32
                <div className="mt-[34px] grid grid-cols-1 gap-x-[48px] md:grid-cols-2 xl:grid-cols-[405px_405px] xl:gap-x-[48px]">
                  {specCols.map((col, i) => (
                    <SpecRows key={i} items={col} align="column" labelWidth={154} className={i > 0 ? "mt-[13px] md:mt-0" : undefined} />
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="flex flex-col gap-[21px]">
              <BrandCard product={product} />
              <Documents documents={product.documents} />
              <ServicesCard product={product} />
            </aside>
          </section>

          {/* Figma: последняя строка характеристик — базовая линия 2208, заголовок с y=2287 (строка 14/21 кончается на 2214) */}
          <section id="accessories" className="mt-16 scroll-mt-[140px] lg:mt-[73px] lg:scroll-mt-[287px]">
            <SectionTitle>Комплектующие</SectionTitle>
            <ProductAccessories items={product.accessories} />
          </section>

          <section id="reviews" className="mt-16 scroll-mt-[140px] lg:mt-[63px] lg:scroll-mt-[287px]">
            <SectionTitle>Отзывы</SectionTitle>
            <Reviews slug={product.slug} initial={reviews} />
          </section>

          <section id="questions" className="mt-16 scroll-mt-[140px] lg:mt-[55px] lg:scroll-mt-[287px]">
            <SectionTitle>Вопросы и ответы</SectionTitle>
            <Questions slug={product.slug} initial={questions} />
          </section>
        </div>
      </div>
    </BuyProvider>
  );
}
