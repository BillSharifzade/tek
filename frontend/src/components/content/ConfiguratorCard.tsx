import { ButtonLink } from "@/components/ui/Button";
import { ImageBox } from "@/components/ui/ImageBox";
import { imageOf, type ConfiguratorItem } from "./types";

export function ConfiguratorCard({ item }: { item: ConfiguratorItem }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[8px] border border-line bg-white">
      <div className="relative aspect-[16/10] w-full bg-surface">
        <ImageBox src={imageOf(item)} alt="" label={item.name} fit="cover" sizes="(max-width: 768px) 100vw, 580px" className="h-full w-full" rounded="rounded-none" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl">{item.name}</h3>
        <p className="mt-2 flex-1 text-base text-sub">{item.description}</p>
        <div className="mt-5">
          <ButtonLink href={item.url}>Перейти на страницу &gt;</ButtonLink>
        </div>
      </div>
    </article>
  );
}
