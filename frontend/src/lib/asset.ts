/**
 * Публичный префикс сайта (next.config basePath), например "/tek" при размещении на dchr.koinotinav.com/tek.
 * next/link и router добавляют его сами; для картинок next/image — глобальный loader (lib/image-loader.ts);
 * для остальных «сырых» адресов (CSS background, <a href> на файлы из /public, ссылки для копирования) — asset().
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** Публичный адрес API (как PUBLIC_API_URL в lib/api — здесь без импорта, asset() нужен и в серверных, и в клиентских модулях). */
const PUBLIC_API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8181/api/v1").replace(/\/+$/, "");
const API_FILES = "/api/v1/files/";

export function asset(path: string): string {
  // файлы, загруженные в панели (картинки новостей и проектов), хранит API: «/api/v1/files/…» → адрес API
  if (path.startsWith(API_FILES)) return `${PUBLIC_API}/files/${path.slice(API_FILES.length)}`;
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${path}` : path;
}
