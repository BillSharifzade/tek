import { ImageBox } from "@/components/ui/ImageBox";
import { cn } from "@/lib/cn";

/** Wide illustration banner used on service / project / news detail pages. */
export function ContentHero({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[16/6] w-full overflow-hidden rounded-[8px] border border-line bg-surface", className)}>
      <ImageBox src={src} alt={alt} fit="cover" sizes="(max-width: 1240px) 100vw, 1200px" className="h-full w-full" rounded="rounded-none" priority />
    </div>
  );
}
