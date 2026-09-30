/**
 * Публичный префикс сайта (next.config basePath), например "/tek" при размещении на dchr.koinotinav.com/tek.
 * next/link и router добавляют его сами; для картинок next/image — глобальный loader (lib/image-loader.ts);
 * для остальных «сырых» адресов (CSS background, <a href> на файлы из /public, ссылки для копирования) — asset().
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function asset(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${path}` : path;
}
