import { cn } from "@/lib/cn";

/** Ссылка на точку в Яндекс.Картах (новая вкладка). */
export function yandexMapsHref(lat: number, lon: number, zoom = 16): string {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=${zoom}&pt=${lon},${lat},pm2ywm&l=map`;
}

/** Адрес виджета Яндекс.Карт с жёлтой меткой в точке (метка двигается вместе с картой). */
export function yandexWidgetSrc(lat: number, lon: number, zoom = 16): string {
  const ll = `${lon.toFixed(6)},${lat.toFixed(6)}`;
  return `https://yandex.ru/map-widget/v1/?ll=${ll}&z=${zoom}&pt=${ll},pm2ywl&l=map`;
}

/**
 * Встроенная интерактивная Яндекс.Карта (виджет в iframe) с меткой в точке. Доработки R4: карт без рекламы
 * со встроенной картой нет — вернули прежний вариант со встроенной картой вместо статичного снимка.
 * Под iframe — `fallback` (фон), пока виджет грузится.
 */
export function YandexMap({ lat, lon, zoom = 16, title, className, fallback }: { lat: number; lon: number; zoom?: number; title: string; className?: string; fallback?: string }) {
  const src = yandexWidgetSrc(lat, lon, zoom);
  return (
    <div className={cn("relative overflow-hidden bg-surface bg-cover bg-center", className)} style={fallback ? { backgroundImage: `url(${fallback})` } : undefined}>
      <iframe key={src} src={src} title={title} loading="lazy" allowFullScreen className="absolute inset-0 size-full border-0" />
    </div>
  );
}
