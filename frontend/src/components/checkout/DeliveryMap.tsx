"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/asset";
import { YandexMap } from "@/components/content/YandexMap";

/** Центр Душанбе по умолчанию (lon, lat). */
export const DUSHANBE: [number, number] = [68.7738, 38.5598];

/** Минимум Яндекс.Карт JS API 2.1, который нужен карте доставки (координаты в API — [lat, lon]). */
interface YMapEvent {
  get(key: "coords"): [number, number];
}
interface YPlacemark {
  geometry: { setCoordinates(c: [number, number]): void; getCoordinates(): [number, number] };
  events: { add(type: string, cb: (e: YMapEvent) => void): void };
}
interface YMap {
  geoObjects: { add(o: YPlacemark): void };
  events: { add(type: string, cb: (e: YMapEvent) => void): void };
  setCenter(c: [number, number], zoom?: number, opts?: { duration?: number }): void;
  getZoom(): number;
  destroy(): void;
}
interface YMaps {
  ready(cb: () => void): void;
  Map: new (el: HTMLElement, state: { center: [number, number]; zoom: number; controls: string[] }) => YMap;
  Placemark: new (c: [number, number], props: Record<string, unknown>, opts: Record<string, unknown>) => YPlacemark;
}

let ymapsPromise: Promise<YMaps> | null = null;

/** Скрипт API грузится один раз на страницу; ключ (NEXT_PUBLIC_YANDEX_MAPS_KEY) необязателен — геокодер у нас свой. */
function loadYmaps(): Promise<YMaps> {
  const w = window as unknown as { ymaps?: YMaps };
  if (w.ymaps) return new Promise((resolve) => w.ymaps!.ready(() => resolve(w.ymaps!)));
  ymapsPromise ??= new Promise<YMaps>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY;
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU${key ? `&apikey=${encodeURIComponent(key)}` : ""}`;
    s.async = true;
    s.onload = () => (w.ymaps ? w.ymaps.ready(() => resolve(w.ymaps!)) : reject(new Error("ymaps")));
    s.onerror = () => {
      ymapsPromise = null;
      reject(new Error("ymaps"));
    };
    document.head.appendChild(s);
  });
  return ymapsPromise;
}

/**
 * Карта доставки (Figma 10461:672, 665×407, без скругления): Яндекс.Карта с жёлтой меткой адреса. Доработки R5 — карта
 * и поле адреса синхронны: клик по карте или перетаскивание метки → `onPick` (адрес подставляет чекаут), новый `center`
 * (адрес введён в поле, «Определить местоположение») → метка и карта переезжают туда. Если API карт не загрузился —
 * прежний виджет в iframe (без выбора точки); пока грузится — снимок карты из макета.
 */
export function DeliveryMap({
  center,
  onPick,
  zoom = 16,
  className,
}: {
  center: [number, number];
  onPick?: (c: [number, number]) => void;
  zoom?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ map: YMap; mark: YPlacemark } | null>(null);
  const pick = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const [lon, lat] = center;

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // карта создаётся один раз; центр дальше двигает эффект ниже
  const initial = useRef<[number, number]>([lat, lon]);
  useEffect(() => {
    let alive = true;
    loadYmaps()
      .then((ymaps) => {
        if (!alive || !box.current) return;
        const m = new ymaps.Map(box.current, { center: initial.current, zoom, controls: ["zoomControl", "geolocationControl"] });
        const mark = new ymaps.Placemark(initial.current, {}, { preset: "islands#dotIcon", iconColor: "#FFCC33", draggable: true });
        m.geoObjects.add(mark);
        const choose = (c: [number, number]) => {
          mark.geometry.setCoordinates(c);
          pick.current?.([c[1], c[0]]);
        };
        m.events.add("click", (e) => choose(e.get("coords")));
        mark.events.add("dragend", () => choose(mark.geometry.getCoordinates()));
        map.current = { map: m, mark };
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      map.current?.map.destroy();
      map.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    const cur = map.current;
    if (!cur) {
      initial.current = [lat, lon];
      return;
    }
    const [mlat, mlon] = cur.mark.geometry.getCoordinates();
    if (Math.abs(mlat - lat) < 1e-6 && Math.abs(mlon - lon) < 1e-6) return;
    cur.mark.geometry.setCoordinates([lat, lon]);
    cur.map.setCenter([lat, lon], Math.max(cur.map.getZoom(), 15), { duration: 300 });
  }, [lat, lon]);

  const cls = cn("h-[300px] w-full bg-[#E8E4DD] sm:h-[407px]", className);
  if (failed) {
    return <YandexMap lat={lat} lon={lon} zoom={zoom} title="Адрес доставки на карте" fallback={asset("/figma/checkout-map.webp")} className={cls} />;
  }
  return (
    <div
      ref={box}
      role="application"
      aria-label="Карта: нажмите на место доставки, чтобы подставить адрес"
      className={cn("relative overflow-hidden bg-cover bg-center", cls)}
      style={{ backgroundImage: `url(${asset("/figma/checkout-map.webp")})` }}
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
