import { cn } from "@/lib/cn";

/** Ссылка на точку в Яндекс.Картах (новая вкладка). */
export function yandexMapsHref(lat: number, lon: number, zoom = 16): string {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=${zoom}&pt=${lon},${lat},pm2ywm&l=map`;
}

/**
 * Карта без рекламы и лишних элементов (линейка, пробки, кнопки): статичный снимок Яндекс.Карт (Static API)
 * с жёлтой меткой; клик открывает точку на Яндекс.Картах. С ключом NEXT_PUBLIC_YANDEX_MAPS_KEY — Static API v1,
 * без ключа — открытая версия 1.x. Снимок 650×450 (максимум API) заполняет блок по `object-cover`, метка — в центре.
 */
export function StaticMap({ lat, lon, zoom = 16, title, className }: { lat: number; lon: number; zoom?: number; title: string; className?: string }) {
  const ll = `${lon},${lat}`;
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY;
  const params = `ll=${ll}&z=${zoom}&size=650,450&lang=ru_RU&pt=${ll},pm2ywl`;
  const src = key ? `https://static-maps.yandex.ru/v1?apikey=${encodeURIComponent(key)}&${params}` : `https://static-maps.yandex.ru/1.x/?l=map&${params}`;
  return (
    <a href={yandexMapsHref(lat, lon, zoom)} target="_blank" rel="noopener noreferrer" className={cn("group relative block overflow-hidden bg-surface", className)}>
      {/* внешний снимок карты: next/image здесь не нужен (без оптимизации и loader'а под basePath) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      <span className="absolute left-[12px] top-[12px] flex h-[32px] items-center gap-[6px] rounded-[5px] bg-white px-[12px] text-[13px] font-medium leading-[16px] text-g333 shadow-soft transition-colors group-hover:text-black">
        Открыть на карте
        <svg width={11} height={11} viewBox="0 0 11 11" fill="none" aria-hidden className="shrink-0">
          <path d="M4.5 1.5H2a1 1 0 0 0-1 1V9a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V6.5M6.5 1H10v3.5M10 1 5 6" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">(откроется в новой вкладке)</span>
      </span>
    </a>
  );
}
