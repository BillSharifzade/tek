import Image from "next/image";
import Link from "next/link";
import type { CategoryNode } from "@/lib/types";
import { SITE } from "@/lib/site";
import { IconPin } from "@/components/icons/figma";
import { CatalogMenuButton } from "./CatalogMenu";
import { CitySelect } from "./CitySelect";
import { HeaderActions } from "./HeaderActions";
import { HeaderNav } from "./HeaderNav";
import { SearchBox } from "./SearchBox";

/**
 * Шапка сайта — 1:1 с компонентом Figma «Шапка сайта» (1512×113, контент 126…1386).
 * Верхняя строка: y=17, 14/12 Medium #666. Вторая строка: y=45…94. Линия #EBEDF8 на y=113.
 */
export function Header({ categories }: { categories: CategoryNode[] }) {
  return (
    <header id="site-header" className="sticky top-0 z-[80] border-b border-line-2 bg-white">
      <div className="container-page">
        <div className="hidden h-[32px] items-start justify-between pt-[17px] lg:flex">
          <HeaderNav />
          <div className="flex items-start">
            <a href={SITE.phoneHref} className="flex w-[94px] items-start gap-[3px] text-[13px] leading-[12px] text-sub link-hover">
              <IconPin className="shrink-0" />
              <span className="mt-px whitespace-nowrap">{SITE.phoneShort}</span>
            </a>
            <CitySelect className="ml-[31px] w-[74px]" />
          </div>
        </div>

        <div className="flex h-[64px] items-center gap-3 lg:mt-[13px] lg:h-[49px] lg:items-start lg:gap-0">
          <Link href="/" aria-label="ТЭК — на главную" className="shrink-0 lg:ml-px lg:mt-[4.9px]">
            <Image src="/figma/logo.png" alt="ТЭК — Точикэлектрокомплект" width={122} height={44} priority className="h-[36px] w-auto lg:h-[44.1px] lg:w-[121.8px]" />
          </Link>
          <div className="shrink-0 lg:ml-[21.2px] lg:mt-[5px]">
            <CatalogMenuButton categories={categories} />
          </div>
          <div className="hidden min-w-0 flex-1 md:block lg:ml-[8px] lg:mt-[5px] xl:w-[504px] xl:flex-none">
            <SearchBox />
          </div>
          <div className="ml-auto hidden shrink-0 md:block md:pl-4 xl:pl-0">
            <HeaderActions />
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <SearchBox />
        </div>
        <div className="hidden h-[19px] lg:block" />
      </div>
    </header>
  );
}
