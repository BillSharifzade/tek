import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import type { Product, QuestionsResponse, ReviewsResponse } from "@/lib/types";
import { optional, personalizedGet, publicGet, safe } from "@/lib/server";
import { qty as fmtQty } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RatingLine } from "@/components/ui/Rating";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductTabsBar } from "@/components/product/ProductTabsBar";
import { Accessories } from "@/components/product/Accessories";
import { Documents } from "@/components/product/Documents";
import { Reviews } from "@/components/product/Reviews";
import { Questions } from "@/components/product/Questions";
import { ImageBox } from "@/components/ui/ImageBox";

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

export default async function ProductRoute({ params }: Props) {
  const { slug } = await params;
  const [product, reviews, questions] = await Promise.all([
    optional(personalizedGet<Product>(`/catalog/products/${slug}`)),
    safe(publicGet<ReviewsResponse>(`/catalog/products/${slug}/reviews`), EMPTY_REVIEWS),
    safe(publicGet<QuestionsResponse>(`/catalog/products/${slug}/questions`), EMPTY_QUESTIONS),
  ]);
  if (!product) notFound();

  const tabs = [
    { id: "specs", label: "Характеристики" },
    { id: "accessories", label: "Комплектующие" },
    { id: "reviews", label: "Отзывы", count: reviews.summary.count || product.reviews_count },
    { id: "questions", label: "Вопросы", count: questions.total || product.questions_count },
  ];

  return (
    <div className="container-page">
      <Breadcrumbs items={[...product.breadcrumbs.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })), { label: product.name }]} />

      <h1 className="max-w-4xl">{product.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-sub">
        <span>Код: {product.code}</span>
        {product.reviews_count > 0 ? <RatingLine rating={product.rating} count={product.reviews_count} /> : null}
        {product.in_stock ? (
          <span className="font-medium text-success">
            В наличии ({fmtQty(product.stock_total)} {product.unit})
          </span>
        ) : (
          <span className="font-medium text-sale">Нет в наличии</span>
        )}
        <Link href={`/brands/${product.brand.slug}`} className="hover:text-ink">
          Бренд: <span className="font-medium text-ink">{product.brand.name}</span>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_520px]">
        <Gallery images={product.images} name={product.name} badges={product.badges} discountPct={product.price.sale ? undefined : product.price.discount_pct || undefined} />
        <BuyBox product={product} />
      </div>

      <div className="mt-10">
        <ProductTabsBar tabs={tabs} />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {product.description ? (
            <section className="mt-8" id="description">
              <h2 className="mb-4">Описание</h2>
              <div className="prose-tek whitespace-pre-line">{product.description}</div>
            </section>
          ) : null}

          <section className="mt-10" id="specs">
            <h2 className="mb-4">Характеристики</h2>
            {product.attributes.length > 0 ? (
              <dl className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                {product.attributes.map((a) => (
                  <div key={a.name} className="flex items-baseline gap-2 border-b border-dashed border-line py-2.5 text-base">
                    <dt className="shrink-0 text-sub">{a.name}</dt>
                    <span className="flex-1" />
                    <dd className="text-right font-medium">{a.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sub">Характеристики уточняйте у менеджера.</p>
            )}
          </section>

          {product.features.length > 0 ? (
            <section className="mt-10" aria-label="Особенности">
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f.title} className="flex gap-4 rounded-[8px] border border-line bg-white p-5">
                    <ImageBox src={null} alt="" label={f.title} className="size-20 shrink-0" />
                    <div>
                      <h3>{f.title}</h3>
                      <p className="mt-1 text-sm text-sub">{f.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10" id="documents">
            <h2 className="mb-4">Документация</h2>
            <Documents documents={product.documents} />
          </section>

          {product.configurator ? (
            <section className="mt-10" id="configurator">
              <Link
                href={product.configurator.url}
                className="group flex flex-col gap-4 rounded-[8px] bg-ink p-6 text-white transition-colors hover:bg-ink-hover sm:flex-row sm:items-center"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
                  <SlidersHorizontal className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold">{product.configurator.name}</span>
                  <span className="block text-sm text-white/70">Автоматический расчёт количества элементов кабеленесущей системы под ваш проект.</span>
                </span>
                <span className="inline-flex items-center gap-1 text-base font-semibold text-brand">
                  Перейти на страницу
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </section>
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[130px] mt-8 rounded-[8px] border border-line bg-white p-5">
            <h3 className="mb-3">Кратко о товаре</h3>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-sub">Код</dt>
                <dd className="font-medium">{product.code}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sub">Бренд</dt>
                <dd className="font-medium">{product.brand.name}</dd>
              </div>
              {product.brand.country_brand ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-sub">Страна бренда</dt>
                  <dd className="font-medium">{product.brand.country_brand}</dd>
                </div>
              ) : null}
              {product.brand.country_origin ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-sub">Страна производства</dt>
                  <dd className="font-medium">{product.brand.country_origin}</dd>
                </div>
              ) : null}
              {product.pack ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-sub">Упаковка</dt>
                  <dd className="font-medium">{product.pack.label}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-sub">Категория</dt>
                <dd className="text-right font-medium">
                  <Link href={`/catalog/${product.category.slug}`} className="hover:text-brand-hover">
                    {product.category.name}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="mt-12" id="accessories">
        <h2 className="mb-5">Комплектующие</h2>
        <Accessories items={product.accessories} />
      </section>

      <section className="mt-12" id="reviews">
        <h2 className="mb-5">Отзывы</h2>
        <Reviews slug={product.slug} initial={reviews} />
      </section>

      <section className="mt-12" id="questions">
        <h2 className="mb-5">Вопросы и ответы</h2>
        <Questions slug={product.slug} initial={questions} />
      </section>
    </div>
  );
}
