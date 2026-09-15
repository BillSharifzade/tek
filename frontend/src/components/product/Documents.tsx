import { Download, FileText, DraftingCompass, BadgeCheck, BookOpen } from "lucide-react";
import type { ProductDocument } from "@/lib/types";
import { API_URL } from "@/lib/api";

const KIND_LABEL: Record<string, string> = {
  certificate: "Сертификаты",
  declaration: "Сертификаты",
  drawing: "Чертежи",
  passport: "Паспорта и инструкции",
  catalog: "Каталоги",
  other: "Прочее",
};

function icon(kind: string) {
  switch (kind) {
    case "drawing":
      return DraftingCompass;
    case "certificate":
    case "declaration":
      return BadgeCheck;
    case "catalog":
      return BookOpen;
    default:
      return FileText;
  }
}

function sizeLabel(kb: number): string {
  if (!kb) return "";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} МБ` : `${Math.round(kb)} КБ`;
}

export function Documents({ documents }: { documents: ProductDocument[] }) {
  if (documents.length === 0) return <p className="text-sub">Документация для этого товара пока не загружена.</p>;
  const groups = new Map<string, ProductDocument[]>();
  for (const d of documents) {
    const label = KIND_LABEL[d.kind] ?? KIND_LABEL.other;
    groups.set(label, [...(groups.get(label) ?? []), d]);
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {[...groups.entries()].map(([label, docs]) => (
        <div key={label}>
          <h3 className="mb-3">{label}</h3>
          <ul className="flex flex-col gap-2">
            {docs.map((d) => {
              const Icon = icon(d.kind);
              const href = d.url?.startsWith("http") ? d.url : `${API_URL}/documents/${d.id}/download`;
              return (
                <li key={d.id}>
                  <a
                    href={href}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-[8px] border border-line bg-white px-4 py-3 transition-colors hover:border-brand"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-brand-light text-ink">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium group-hover:text-brand-hover">{d.title}</span>
                      <span className="block text-xs text-sub">PDF{d.size_kb ? ` · ${sizeLabel(d.size_kb)}` : ""}</span>
                    </span>
                    <Download className="size-4 shrink-0 text-sub group-hover:text-ink" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
