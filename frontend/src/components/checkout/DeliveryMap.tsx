"use client";

import { cn } from "@/lib/cn";
import { asset } from "@/lib/asset";
import { YandexMap } from "@/components/content/YandexMap";

/** Центр Душанбе по умолчанию (lon, lat). */
export const DUSHANBE: [number, number] = [68.7738, 38.5598];

/**
 * Карта доставки (Figma 10461:672, 665×407, без скругления): встроенная Яндекс.Карта с жёлтой меткой по координатам
 * адреса — меняется вместе с адресом / точкой «Определить местоположение». Доработки R4: прежний вариант со встроенной
 * картой вместо статичного снимка. Пока виджет грузится — снимок карты из макета.
 */
export function DeliveryMap({ center, zoom = 16, className }: { center: [number, number]; zoom?: number; className?: string }) {
  const [lon, lat] = center;
  return (
    <YandexMap
      lat={lat}
      lon={lon}
      zoom={zoom}
      title="Адрес доставки на карте"
      fallback={asset("/figma/checkout-map.webp")}
      className={cn("h-[300px] w-full bg-[#E8E4DD] sm:h-[407px]", className)}
    />
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
