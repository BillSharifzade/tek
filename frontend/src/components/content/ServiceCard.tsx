import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ImageBox } from "@/components/ui/ImageBox";
import { imageOf, type ServiceItem } from "./types";

export function ServiceCard({ service }: { service: Pick<ServiceItem, "slug" | "title" | "short" | "image" | "image_url"> }) {
  const href = `/services/${service.slug}`;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-line bg-white transition-colors hover:border-brand">
      <Link href={href} className="relative block aspect-[16/10] w-full bg-surface" tabIndex={-1} aria-hidden>
        <ImageBox src={imageOf(service)} alt="" label={service.title} fit="cover" sizes="(max-width: 768px) 100vw, 400px" className="h-full w-full" rounded="rounded-none" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3>
          <Link href={href} className="group-hover:text-brand-hover">
            {service.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-sub">{service.short}</p>
        <Link href={href} className="mt-4 inline-flex items-center gap-1 text-base font-medium hover:text-brand-hover">
          Подробнее
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
