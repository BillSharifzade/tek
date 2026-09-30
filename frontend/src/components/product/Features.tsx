import Image from "next/image";
import type { Product } from "@/lib/types";

/** Иллюстрация особенности: для лотков — фото стыка из макета, иначе фото товара. */
function featureImage(product: Product): string | null {
  const main = product.images[0] ?? product.image;
  if (main === "/figma/tray.webp") return "/figma/tray-joint.webp";
  return main ?? null;
}

/**
 * Карточки-преимущества (Figma «Преимущество 1/2»): 440×142, #F6F7F8, r10;
 * заголовок 16/20 600, текст 14/19 #333 (до 241px), фото 145×142 r7 справа.
 */
export function Features({ product }: { product: Product }) {
  if (product.features.length === 0) return null;
  const img = featureImage(product);
  return (
    <ul className="grid grid-cols-1 gap-[26px] md:grid-cols-2">
      {product.features.map((f) => (
        <li key={f.title} className="relative flex min-h-[142px] rounded-[10px] bg-surface">
          <div className="min-w-0 flex-1 pb-[18px] pl-[24px] pr-[16px] pt-[18px] md:max-w-[281px] md:pr-0">
            <h3 className="text-[16px] font-semibold leading-[20px] text-black">{f.title}</h3>
            <p className="mt-[9px] text-[14px] leading-[19px] text-g333">{f.text}</p>
          </div>
          {img ? (
            <div className="relative ml-auto hidden w-[145px] shrink-0 overflow-hidden rounded-[7px] sm:block">
              <Image src={img} alt="" fill sizes="145px" unoptimized className="object-contain object-top" />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
