import { GridSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Каркас лендинга в геометрии макета 10999:2802: фото+новости, вендоры, направления, преимущества, категории, новинки. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <div className="container-page mt-4 lg:mt-[31px]">
        <div className="flex flex-col gap-4 lg:ml-px lg:grid lg:h-[439px] lg:grid-cols-[888fr_349fr] lg:gap-[22px]">
          <Skeleton className="aspect-[888/439] w-full rounded-[11px] lg:aspect-auto lg:h-full" />
          <div className="rounded-[11px] bg-surface-2 px-[28px] pb-6 pt-[23px]">
            <Skeleton className="h-[22px] w-[110px]" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={i > 0 ? "mt-[16px] border-t border-[#E0E4EA] pt-[17px]" : "mt-[22px]"}>
                <Skeleton className="h-[14px] w-[76px]" />
                <Skeleton className="mt-[10px] h-[16px] w-full" />
                <Skeleton className="mt-[8px] h-[16px] w-3/4" />
                <Skeleton className="mt-[16px] h-[14px] w-[130px]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container-page mt-10 lg:mt-[34px]">
        <Skeleton className="h-[92px] w-full rounded-[11px]" />
      </div>

      <div className="container-page mt-10 lg:mt-[51px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:ml-px xl:mr-[-1px] xl:grid-cols-[458fr_385fr_385fr] xl:grid-rows-[122px_122px] xl:gap-x-[16px] xl:gap-y-[14px]">
          <Skeleton className="h-[258px] rounded-[8px] sm:col-span-2 xl:col-span-1 xl:row-span-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[122px] rounded-[8px]" />
          ))}
        </div>
      </div>

      <div className="container-page mt-10 lg:mt-[60px]">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:mx-px xl:grid-cols-4 xl:gap-x-[70px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-[14px]">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-[14px] w-full" />
                <Skeleton className="mt-[6px] h-[14px] w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page mt-10 lg:mt-[60px]">
        <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:ml-px lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[122px] rounded-[8px]" />
          ))}
        </div>
      </div>

      <div className="container-page mt-14 flex flex-col items-center lg:mt-[69px]">
        <Skeleton className="h-[26px] w-[160px]" />
        <Skeleton className="mt-[20px] h-[44px] w-[96px] rounded-[7px]" />
        <div className="mt-8 w-full lg:px-px">
          <GridSkeleton count={5} cols={5} />
        </div>
      </div>
    </div>
  );
}
