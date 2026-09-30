import type { ProductDocument } from "@/lib/types";
import { PUBLIC_API_URL } from "@/lib/api";
import { IconDownload } from "./icons";

/** Группы документации как в макете: Сертификаты / Описание / Чертежи (+ Каталоги). */
const KIND_GROUP: Record<string, string> = {
  certificate: "Сертификаты",
  declaration: "Сертификаты",
  passport: "Описание",
  other: "Описание",
  drawing: "Чертежи",
  catalog: "Каталоги",
};
const GROUP_ORDER = ["Сертификаты", "Описание", "Чертежи", "Каталоги"];

function sizeLabel(kb: number): string {
  if (!kb) return "";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} МБ` : `${Math.round(kb)} КБ`;
}

export function docHref(d: ProductDocument): string {
  return d.url?.startsWith("http") ? d.url : `${PUBLIC_API_URL}/documents/${d.id}/download`;
}

/** Заголовок боковой карточки: 14/15 #808080 и линия #D9DDE4 под ним (Figma «Документация», «Сервисы»). */
export function AsideHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[43px] border-b border-line-3 pt-[17px]">
      <h2 className="text-[14px] font-normal leading-[15px] text-muted">{children}</h2>
    </div>
  );
}

/**
 * Карточка «Документация» (Figma 8612:301): 305 шириной, r10, тень; группы 16/20 600,
 * документы — иконка скачивания 24×24 (#EEF0F2, r6) + название 14/16, шаг 33. Скачивание по клику.
 */
export function Documents({ documents }: { documents: ProductDocument[] }) {
  if (documents.length === 0) return null;
  const groups = new Map<string, ProductDocument[]>();
  for (const d of documents) {
    const label = KIND_GROUP[d.kind] ?? KIND_GROUP.other;
    groups.set(label, [...(groups.get(label) ?? []), d]);
  }
  const ordered = GROUP_ORDER.filter((g) => groups.has(g)).map((g) => [g, groups.get(g)!] as const);

  return (
    <section id="documents" className="rounded-[10px] bg-white pb-[27px] pl-[26px] pr-[28px] shadow-pop" aria-label="Документация">
      <AsideHead>Документация</AsideHead>
      <div className="mt-[12px] flex flex-col gap-[22px]">
        {ordered.map(([label, docs]) => (
          <div key={label}>
            <h3 className="text-[16px] font-semibold leading-[20px] text-black">{label}</h3>
            <ul className="mt-[14px] flex flex-col gap-[9px]">
              {docs.map((d) => (
                <li key={d.id}>
                  <a
                    href={docHref(d)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Скачать PDF${d.size_kb ? `, ${sizeLabel(d.size_kb)}` : ""}`}
                    className="group flex items-start"
                  >
                    <IconDownload className="ml-px shrink-0 rounded-[6px] transition-colors [&>rect]:transition-colors group-hover:[&>rect]:fill-[#D9DDE3]" />
                    <span className="ml-[9px] mt-[3px] text-[14px] leading-[16px] text-black">{d.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
