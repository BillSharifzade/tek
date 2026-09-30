import { asset } from "./asset";

/**
 * Loader для next/image при размещении под basePath (Next не добавляет basePath к src картинок сам).
 * Оптимизация не нужна — отдаём файл как есть: SVG-иллюстрации и уже сжатые webp.
 */
export default function tekImageLoader({ src }: { src: string; width: number; quality?: number }): string {
  return asset(src);
}
