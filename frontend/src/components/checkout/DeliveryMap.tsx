"use client";

/** Центр Душанбе по умолчанию (lon, lat). */
export const DUSHANBE: [number, number] = [68.7738, 38.5598];

/**
 * Карта доставки (Figma 10461:672, 665×407, без скругления). В макете — снимок чужой карты; здесь — статичная карта
 * Яндекса (Static API, без рекламы, линейки и пробок, как на «Контактах») с жёлтой меткой по координатам адреса:
 * меняется вместе с адресом / точкой «Определить местоположение». Ссылка «Открыть на карте» — в новой вкладке.
 */
export function DeliveryMap({ center, zoom = 16, className }: { center: [number, number]; zoom?: number; className?: string }) {
  const [lon, lat] = center.map((n) => n.toFixed(6));
  const ll = `${lon},${lat}`;
  const href = `https://yandex.ru/maps/?ll=${ll}&z=${zoom}&pt=${ll},pm2ywm&l=map`;
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY;
  const params = `ll=${ll}&z=${zoom}&size=650,407&lang=ru_RU&pt=${ll},pm2ywl`;
  const src = key ? `https://static-maps.yandex.ru/v1?apikey=${encodeURIComponent(key)}&${params}` : `https://static-maps.yandex.ru/1.x/?l=map&${params}`;
  return (
    <div className={`relative h-[300px] w-full overflow-hidden bg-[#E8E4DD] sm:h-[407px] ${className ?? ""}`}>
      {/* внешний снимок карты — обычный img (next/image для внешних адресов не настроен) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt={`Адрес доставки на карте (${lat}, ${lon})`} decoding="async" className="absolute inset-0 size-full object-cover" />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute left-[12px] top-[12px] flex h-[32px] items-center gap-[6px] rounded-[5px] bg-white px-[12px] text-[13px] font-medium leading-[16px] text-g333 shadow-soft transition-colors hover:text-black"
      >
        Открыть на карте
        <svg width={11} height={11} viewBox="0 0 11 11" fill="none" aria-hidden className="shrink-0">
          <path d="M4.5 1.5H2a1 1 0 0 0-1 1V9a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V6.5M6.5 1H10v3.5M10 1 5 6" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">(откроется в новой вкладке)</span>
      </a>
    </div>
  );
}

/** Nominatim (OSM) — обратное геокодирование координат в строку адреса на русском. */
export async function reverseGeocode(lon: number, lat: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ru&zoom=18`);
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: Record<string, string>; display_name?: string };
    const a = j.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.state ?? "";
    const street = [a.road, a.house_number].filter(Boolean).join(", ");
    const s = [city, street].filter(Boolean).join(", ");
    return s || j.display_name || null;
  } catch {
    return null;
  }
}

/** Nominatim — поиск координат по введённому адресу (в пределах Таджикистана). */
export async function geocode(query: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tj&accept-language=ru&q=${encodeURIComponent(query)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { lat: string; lon: string }[];
    if (!j[0]) return null;
    return [Number(j[0].lon), Number(j[0].lat)];
  } catch {
    return null;
  }
}
