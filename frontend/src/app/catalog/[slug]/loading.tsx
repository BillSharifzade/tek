import { ProductCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Скелет листинга в геометрии макета «Каталог»: крошки y=157, заголовок y=188, фильтры 240px | сортировка + сетка 4×226. */
export default function Loading() {
  return (
    <div className="container-page pb-[78px]" aria-busy="true" aria-label="Загрузка каталога">
      <Skeleton className="mt-[20px] h-[15px] w-[270px] lg:mt-[43px]" />
      <Skeleton className="mt-[14px] h-[19px] w-[360px] max-w-full" />
      <div className="mt-[28px] grid grid-cols-1 gap-[24px] lg:mt-[49px] lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-0">
        <div className="hidden lg:block lg:pl-[1px] lg:pt-[11px]">
          <Skeleton className="h-[600px] w-[240px]" />
        </div>
        <div className="min-w-0">
          <Skeleton className="h-[32px] w-[528px] max-w-full" />
          <div className="mt-[28px] grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-[repeat(4,226px)] xl:justify-between xl:gap-x-0 xl:gap-y-[82px]">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
