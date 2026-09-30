import Link from "next/link";
import type { ReactNode } from "react";
import { countLabel } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Prose } from "@/components/content/Prose";
import { ProductGrid } from "@/components/product/ProductGrid";
import { projectBrands, projectImage, serviceTags, type BrandLite, type ProjectDetail } from "./model";
import { AsideCard, BrandLinks, BrandTiles, FactList, OtherProjects, PhotoGrid, ProjectHero, ProjectVideo, SectionHeading, ServiceFact } from "./detail";

/** Похожие проекты: сначала с общими видами работ, по порядку списка после текущего. */
function pickOthers(all: ProjectDetail[], current: ProjectDetail, n = 3): ProjectDetail[] {
  const idx = all.findIndex((p) => p.slug === current.slug);
  const ring = [...all.slice(idx + 1), ...all.slice(0, Math.max(0, idx))].filter((p) => p.slug !== current.slug);
  const mine = new Set(serviceTags(current.service));
  const related = ring.filter((p) => serviceTags(p.service).some((s) => mine.has(s)));
  const out = [...related, ...ring.filter((p) => !related.includes(p))];
  return out.slice(0, n);
}

/**
 * Страница проекта: название, краткие данные (год, услуги, объект, бренды, продукция), описание, видео YouTube,
 * фото с объекта, применённые продукты каталога, другие проекты. Блоки без данных не выводятся.
 */
export function ProjectView({ project, catalog, all }: { project: ProjectDetail; catalog: BrandLite[]; all: ProjectDetail[] }) {
  const image = projectImage(project);
  const tags = serviceTags(project.service);
  const brands = projectBrands(project, catalog);
  const products = project.products ?? [];
  const photos = (project.photos ?? []).filter((src) => src && src !== image);
  const video = project.video_url?.trim() || null;
  const others = pickOthers(all, project);

  type Fact = { label: string; value: ReactNode };
  const facts = ([
    project.year ? { label: "Год", value: <span className="tnum">{project.year}</span> } : null,
    project.object ? { label: "Объект", value: project.object } : null,
    tags.length > 0 ? { label: "Услуги", value: <ServiceFact tags={tags} /> } : null,
    brands.length > 0 ? { label: "Бренды", value: <BrandLinks brands={brands} /> } : null,
    products.length > 0
      ? {
          label: "Продукция",
          value: (
            <a href="#products" className="link-hover underline decoration-[#B3BAC7] underline-offset-[3px] hover:decoration-black">
              {countLabel(products.length, ["позиция", "позиции", "позиций"])} из каталога
            </a>
          ),
        }
      : null,
  ] as (Fact | null)[]).filter((f): f is Fact => f !== null);

  const hasAside = brands.length > 0;

  return (
    <>
      <div className="container-page pb-[64px] md:pb-[90px]">
        <div className="pt-[24px] md:pt-[42px]">
          <Breadcrumbs items={[{ href: "/projects", label: "Проекты" }, { label: project.title }]} />
        </div>

        <div className="mt-[20px] md:mt-[27px]">
          <ProjectHero
            project={project}
            image={image}
            facts={<FactList items={facts} />}
            actions={
              <>
                <Link href="/contacts#feedback" className="inline-flex h-[54px] items-center rounded-[7px] bg-brand px-[24px] text-[16px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover">
                  Обсудить похожий проект
                </Link>
                <Link href="/projects" className="inline-flex h-[54px] items-center rounded-[7px] border border-outline bg-white px-[24px] text-[16px] font-medium leading-[24px] text-g333 transition-colors hover:border-outline-hover hover:text-black">
                  Все проекты
                </Link>
              </>
            }
          />
        </div>

        <div className={hasAside ? "mt-[48px] grid grid-cols-1 gap-[40px] md:mt-[70px] lg:grid-cols-[minmax(0,1fr)_417px] lg:gap-[60px]" : "mt-[48px] md:mt-[70px]"}>
          <div className="min-w-0 max-w-[851px]">
            <SectionHeading>Описание проекта</SectionHeading>
            {project.body ? (
              <Prose html={project.body} className="mt-[20px] text-g333! md:text-[16px]! md:leading-[26px]!" />
            ) : project.excerpt ? (
              <p className="mt-[20px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">{project.excerpt}</p>
            ) : (
              <p className="mt-[20px] text-[15px] leading-[24px] text-muted">Подробное описание проекта готовится.</p>
            )}

            {video ? (
              <section className="mt-[40px] md:mt-[56px]">
                <SectionHeading>Видео</SectionHeading>
                <div className="mt-[20px]">
                  <ProjectVideo url={video} title={project.title} />
                </div>
              </section>
            ) : null}

            {photos.length > 0 ? (
              <section className="mt-[40px] md:mt-[56px]">
                <SectionHeading>Фото с объекта</SectionHeading>
                <div className="mt-[20px]">
                  <PhotoGrid photos={photos} title={project.title} />
                </div>
              </section>
            ) : null}
          </div>

          {hasAside ? (
            <aside className="self-start lg:sticky lg:top-[134px]">
              <AsideCard title="Оборудование брендов">
                <BrandTiles brands={brands} />
              </AsideCard>
            </aside>
          ) : null}
        </div>

        {products.length > 0 ? (
          <section className="mt-[56px] md:mt-[80px]">
            <SectionHeading id="products">Применённые продукты</SectionHeading>
            <ProductGrid products={products} cols={5} className="mt-[24px] md:mt-[32px]" />
          </section>
        ) : null}
      </div>

      <OtherProjects projects={others} />
    </>
  );
}
