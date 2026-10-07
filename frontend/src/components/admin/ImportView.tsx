"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { ImportResult } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { int } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, labelCls } from "@/components/account/shared";
import { ConfirmModal, ErrorLine, Tag, isAdmin, loadErrorMessage } from "./shared";

const COLUMNS: { name: string; text: string }[] = [
  { name: "Код*", text: "артикул — обязательный; по нему находится существующий товар (иначе создаётся новый)" },
  { name: "Наименование", text: "название товара (обязательно для новых)" },
  { name: "Категория", text: "путь «Раздел / Подраздел»; недостающие категории создаются" },
  { name: "Бренд", text: "название бренда; новый бренд создаётся автоматически" },
  { name: "Ед. изм.", text: "шт, м, кг…" },
  { name: "Цена", text: "обычная цена, сомони" },
  { name: "Цена распродажи", text: "пусто — без распродажи" },
  { name: "Кратность", text: "шаг количества (упаковка), например 100 для кабеля в бухтах" },
  { name: "Описание", text: "текст карточки товара" },
  { name: "Изображение", text: "ссылка или путь к картинке" },
  { name: "Остаток <склад>", text: "по колонке на склад, например «Остаток Центральный склад»" },
  { name: "Хар: <название>", text: "характеристика для фильтров, например «Хар: Сечение, мм²»" },
];

const MAX_SIZE = 20 * 1024 * 1024;

/** «Импорт каталога» (только администратор): проверка файла без сохранения, затем загрузка; шаблон .xlsx и описание колонок. */
export function ImportView() {
  const user = useAuth((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | "template" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checked, setChecked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!isAdmin(user)) {
    return (
      <Card>
        <CardTitle>Импорт каталога</CardTitle>
        <p className={cn("mt-[21px]", labelCls)}>Загрузка каталога доступна только администратору. Чтобы обновить цены или остатки, обратитесь к администратору или используйте раздел «Товары».</p>
      </Card>
    );
  }

  const pick = (f: File | null) => {
    setError(null);
    setResult(null);
    setChecked(null);
    if (f && !/\.(xlsx|csv)$/i.test(f.name)) {
      setFile(null);
      setError("Нужен файл .xlsx или .csv");
      return;
    }
    if (f && f.size > MAX_SIZE) {
      setFile(null);
      setError("Файл больше 20 МБ — разбейте его на части");
      return;
    }
    setFile(f);
  };

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "check" : "apply");
    setError(null);
    try {
      const r = await adminApi.importCatalog(file, dryRun);
      setResult(r);
      if (dryRun) {
        setChecked(file);
        toast.info(r.errors.length ? `Проверка: ${r.errors.length} ошибок` : "Проверка прошла без ошибок");
      } else {
        setChecked(null);
        toast.success(`Каталог загружен: создано ${r.created}, обновлено ${r.updated}`);
      }
      setConfirm(false);
    } catch (e) {
      setError(loadErrorMessage(e, "Не удалось обработать файл"));
      setConfirm(false);
    } finally {
      setBusy(null);
    }
  };

  const template = async () => {
    setBusy("template");
    try {
      await adminApi.downloadImportTemplate();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось скачать шаблон"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle
          right={
            <Button variant="ghost" className={cn(btnCls, "px-[10px]")} icon={<Download className="size-4" aria-hidden />} loading={busy === "template"} onClick={template}>
              Шаблон .xlsx
            </Button>
          }
        >
          Загрузка файла
        </CardTitle>
        <p className={cn("mt-[21px]", labelCls)}>Сначала нажмите «Проверить» — файл будет разобран без сохранения, вы увидите итоги и ошибки по строкам. Затем «Загрузить» применит изменения: новые товары создадутся, существующие (по коду) обновятся.</p>

        <div className="mt-[20px] flex flex-wrap items-center gap-[12px]">
          <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="Файл каталога" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[56px] min-w-[280px] flex-1 items-center gap-[12px] rounded-[7px] border border-dashed border-outline bg-surface-2 px-[16px] py-[10px] text-left transition-colors hover:border-outline-hover sm:max-w-[460px]"
          >
            <FileSpreadsheet className="size-[24px] shrink-0 text-black" strokeWidth={1.6} aria-hidden />
            {file ? (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium leading-[20px]">{file.name}</span>
                <span className="block text-[13px] leading-[18px] text-[#555] tnum">{file.size < 1024 ? "меньше 1 КБ" : file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} КБ` : `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`} · нажмите, чтобы выбрать другой</span>
              </span>
            ) : (
              <span className="text-[15px] leading-[20px] text-[#555]">Выберите файл .xlsx или .csv</span>
            )}
          </button>
          <Button variant="secondary" className={btnCls} disabled={!file || busy !== null} loading={busy === "check"} onClick={() => run(true)}>
            Проверить
          </Button>
          <Button className={btnCls} icon={<Upload className="size-4" aria-hidden />} disabled={!file || busy !== null} loading={busy === "apply"} onClick={() => setConfirm(true)}>
            Загрузить
          </Button>
        </div>
        <ErrorLine error={error} className="mt-[16px]" />
      </Card>

      {result ? <ResultCard result={result} /> : null}

      <Card>
        <CardTitle>Формат файла</CardTitle>
        <p className={cn("mt-[21px]", labelCls)}>Первая строка — заголовки колонок (порядок любой), дальше — по товару в строке; обязательна только колонка «Код». Проще всего начать с шаблона.</p>
        <dl className="mt-[16px] grid grid-cols-1 gap-x-[24px] gap-y-[8px] text-[14px] leading-[19px] md:grid-cols-[200px_1fr]">
          {COLUMNS.map((c) => (
            <div key={c.name} className="contents">
              <dt className="font-semibold text-black">{c.name}</dt>
              <dd className="text-[#555] max-md:mb-[6px]">{c.text}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <ConfirmModal open={confirm} title="Загрузить каталог?" confirmLabel="Загрузить" busy={busy === "apply"} onConfirm={() => run(false)} onClose={() => setConfirm(false)}>
        {checked === file && result ? (
          <>
            По результатам проверки будет создано {int(result.created)} и обновлено {int(result.updated)} товаров
            {result.errors.length ? `; строки с ошибками (${result.errors.length}) будут пропущены` : ""}.
          </>
        ) : (
          <>Файл ещё не проверялся. Изменения сразу попадут на сайт — рекомендуем сначала нажать «Проверить».</>
        )}
      </ConfirmModal>
    </div>
  );
}

function ResultCard({ result: r }: { result: ImportResult }) {
  const stats: [string, number][] = [
    ["Строк в файле", r.rows],
    ["Новых товаров", r.created],
    ["Обновлено", r.updated],
    ["Пропущено", r.skipped],
    ["Новых категорий", r.categories_created],
    ["Новых брендов", r.brands_created],
    ["Строк остатков", r.stock_rows],
  ];
  return (
    <Card>
      <CardTitle right={r.dry_run ? <Tag tone="yellow">проверка — ничего не сохранено</Tag> : <Tag tone="green">изменения сохранены</Tag>}>{r.dry_run ? "Результат проверки" : "Результат загрузки"}</CardTitle>
      <dl className="mt-[21px] grid grid-cols-2 gap-[12px] sm:grid-cols-4 xl:grid-cols-7">
        {stats.map(([title, n]) => (
          <div key={title} className="rounded-[7px] bg-surface-2 px-[14px] py-[12px]">
            <dt className="text-[13px] leading-[17px] text-[#555]">{title}</dt>
            <dd className={cn("mt-[4px] text-[20px] font-bold leading-[24px] tnum", title === "Пропущено" && n > 0 && "text-[#D13B3E]")}>{int(n)}</dd>
          </div>
        ))}
      </dl>
      {r.ignored_columns?.length ? (
        <p className={cn("mt-[16px]", labelCls)}>
          Колонки, которые импорт не знает (пропущены): <span className="text-black">{r.ignored_columns.map((c) => `«${c}»`).join(", ")}</span>
        </p>
      ) : null}
      {r.errors.length > 0 ? (
        <>
          <h3 className="mt-[26px] text-[16px] font-semibold leading-[20px]">
            Ошибки {r.errors.length > 50 ? `(первые 50 из ${r.errors.length})` : `(${r.errors.length})`}
          </h3>
          <DataTable
            className="mt-[12px]"
            dense
            columns={[
              { key: "row", header: "Строка", className: "w-[90px]", cell: (e) => <span className="tnum">{e.row}</span> },
              { key: "msg", header: "Ошибка", cell: (e) => <span className="text-sale-text">{e.message}</span> },
            ]}
            rows={r.errors.slice(0, 50)}
            rowKey={(e, i) => `${e.row}-${i}`}
          />
        </>
      ) : (
        <p className={cn("mt-[20px]", labelCls)}>Ошибок нет.</p>
      )}
    </Card>
  );
}
