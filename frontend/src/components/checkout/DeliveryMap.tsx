"use client";

/** Центр Душанбе по умолчанию (lon, lat). */
export const DUSHANBE: [number, number] = [68.7738, 38.5598];

/**
 * Карта доставки (Figma 10461:672, 665×407): живая Яндекс.Карта в iframe, поверх — пин из макета
 * (чёрная капля 33×49 с жёлтым кругом), остриём в центр карты. Под iframe — статичный скрин
 * из макета как фолбэк, если виджет не загрузился.
 */
export function DeliveryMap({ center, zoom = 13, className }: { center: [number, number]; zoom?: number; className?: string }) {
  const src = `https://yandex.ru/map-widget/v1/?ll=${center[0].toFixed(6)},${center[1].toFixed(6)}&z=${zoom}&l=map`;
  return (
    <div
      className={`relative h-[300px] w-full overflow-hidden sm:h-[407px] bg-[#E8E4DD] bg-cover bg-center ${className ?? ""}`}
      style={{ backgroundImage: "url(/figma/checkout-map.webp)" }}
    >
      <iframe key={src} src={src} title="Карта доставки" loading="lazy" className="absolute inset-0 size-full border-0" allow="geolocation" />
      <svg
        width={34}
        height={50}
        viewBox="0 0 34 50"
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
      >
        <path d="M17 .5C7.9.5.5 7.9.5 17c0 5.6 2.6 9.9 6.4 14.3L17 49.5l10.1-18.2c3.8-4.4 6.4-8.7 6.4-14.3C33.5 7.9 26.1.5 17 .5Z" fill="#292829" />
        <circle cx="17" cy="17" r="12.5" fill="#FBC642" />
      </svg>
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
