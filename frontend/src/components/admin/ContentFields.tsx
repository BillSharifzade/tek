"use client";

import { ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";

/** Подпись поля панели над контролом. */
export function FieldLabel({ label, hint, htmlFor, children, className }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      <div className="mt-[6px]">{children}</div>
      {hint ? <p className="mt-[4px] text-[13px] leading-[18px] text-muted">{hint}</p> : null}
    </div>
  );
}

/** Картинка: превью, ссылка (https://… или путь на сайте) или загрузка файла в хранилище (JPG, PNG, WebP, GIF до 20 МБ). */
export function ImageField({ label, value, onChange, id, className }: { label: string; value: string; onChange: (v: string) => void; id: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error("Файл больше 20 МБ");
    setBusy(true);
    try {
      const f = await adminApi.uploadFile(file, "image");
      onChange(f.url);
      toast.success("Картинка загружена");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось загрузить картинку"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FieldLabel label={label} htmlFor={id} className={className}>
      <div className="flex flex-wrap items-start gap-[12px]">
        <div className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-line bg-surface">
          {value ? (
            // превью любого адреса (в том числе загруженного файла с адреса API) — next/image здесь не нужен
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset(value)} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted" aria-hidden />
          )}
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-[8px]">
          <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ссылка https://… или загрузите файл" className={fieldCls} />
          <div className="flex flex-wrap gap-[8px]">
            <Button variant="secondary" size="sm" className={btnCls} loading={busy} onClick={() => fileRef.current?.click()}>
              Загрузить файл
            </Button>
            {value ? (
              <Button variant="outline" size="sm" className={btnCls} onClick={() => onChange("")}>
                Убрать
              </Button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload(f);
            }}
          />
        </div>
      </div>
    </FieldLabel>
  );
}

export const MARKUP_HINT = "Абзацы — через пустую строку; «- » в начале строки — пункт списка, «1. » — нумерованный; «## » — подзаголовок; **жирный**; [текст](https://ссылка).";

/** Текст страницы в разметке панели (на сайт уходит готовый HTML без скриптов). */
export function MarkupField({ label, value, onChange, id, rows = 14, className }: { label: string; value: string; onChange: (v: string) => void; id: string; rows?: number; className?: string }) {
  return (
    <FieldLabel label={label} htmlFor={id} hint={MARKUP_HINT} className={className}>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={50000} className={cn(fieldCls, "h-auto py-[8px] font-[inherit] leading-[22px]")} />
    </FieldLabel>
  );
}

/** «a, b; c» → ["a", "b", "c"] — для тегов, кодов товаров. */
export function splitList(v: string): string[] {
  return v
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
