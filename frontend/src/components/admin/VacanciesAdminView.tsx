"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminVacancy, VacancyInput } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Checkbox";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardTitle, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import { FieldLabel } from "./ContentFields";
import { ConfirmModal, ErrorLine, Tag, useLoad } from "./shared";

const iconBtn = "inline-flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-btn hover:text-black";
const DEFAULT_BLOCKS = ["Обязанности", "Требования", "Условия"];

/** «Вакансии»: открытые вакансии страницы /vacancies — добавить, изменить, скрыть с сайта, удалить. */
export function VacanciesAdminView() {
  const list = useLoad("vacancies", () => adminApi.vacancies(), "Не удалось загрузить вакансии");
  const [edit, setEdit] = useState<AdminVacancy | "new" | null>(null);
  const [remove, setRemove] = useState<AdminVacancy | null>(null);
  const [busy, setBusy] = useState(false);

  const doRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await adminApi.deleteVacancy(remove.id);
      toast.success("Вакансия удалена");
      setRemove(null);
      list.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось удалить вакансию"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (v: AdminVacancy, active: boolean) => {
    try {
      const next = await adminApi.updateVacancy(v.id, { ...v, is_active: active });
      list.mutate((d) => d.map((x) => (x.id === v.id ? next : x)));
      toast.success(active ? "Вакансия снова на сайте" : "Вакансия скрыта с сайта");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить вакансию"));
    }
  };

  return (
    <Card className="min-h-[300px]">
      <CardTitle
        right={
          <Button className={btnCls} icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit("new")}>
            Добавить вакансию
          </Button>
        }
      >
        Вакансии
      </CardTitle>
      <ErrorLine error={list.error} className="mt-[20px]" />
      {list.data === null ? (
        list.error ? null : <Skeleton className="mt-[24px] h-[200px] rounded-[7px]" />
      ) : list.data.length === 0 ? (
        <p className={cn("mt-[24px]", labelCls)}>Вакансий нет — на сайте показывается «Открытых вакансий сейчас нет».</p>
      ) : (
        <ul className="mt-[24px] divide-y divide-line border-y border-line">
          {list.data.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px] py-[12px]">
              <div className="min-w-[220px] flex-1">
                <p className="text-[13px] leading-[18px] text-[#555]">{v.dept}</p>
                <p className="text-[16px] font-semibold leading-[22px]">
                  {v.title} {!v.is_active ? <Tag tone="red">скрыта</Tag> : null}
                </p>
                <p className="text-[13px] leading-[18px] text-[#555]">{[v.city, v.experience, v.schedule, v.salary].filter(Boolean).join(" · ")}</p>
              </div>
              <Toggle checked={v.is_active} onChange={(on) => toggle(v, on)} label={<span className="text-[14px] text-[#555]">На сайте</span>} />
              <span className="inline-flex gap-[4px]">
                <button type="button" className={iconBtn} onClick={() => setEdit(v)} aria-label={`Изменить: ${v.title}`} title="Изменить">
                  <Pencil className="size-4" />
                </button>
                <button type="button" className={iconBtn} onClick={() => setRemove(v)} aria-label={`Удалить: ${v.title}`} title="Удалить">
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-[16px] text-[13px] leading-[18px] text-sub">Порядок на сайте — как в списке; изменения появляются на сайте в течение нескольких минут.</p>

      {edit ? (
        <VacancyModal
          key={edit === "new" ? "new" : edit.id}
          vacancy={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            list.reload();
          }}
        />
      ) : null}
      <ConfirmModal open={remove !== null} title="Удалить вакансию?" confirmLabel="Удалить" danger busy={busy} onConfirm={doRemove} onClose={() => setRemove(null)}>
        «{remove?.title}» пропадёт с сайта. Чтобы временно убрать вакансию, выключите «На сайте».
      </ConfirmModal>
    </Card>
  );
}

function VacancyModal({ vacancy, onClose, onSaved }: { vacancy: AdminVacancy | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: vacancy?.title ?? "",
    dept: vacancy?.dept ?? "",
    city: vacancy?.city ?? "Душанбе",
    experience: vacancy?.experience ?? "",
    schedule: vacancy?.schedule ?? "Полная занятость",
    salary: vacancy?.salary ?? "",
  });
  const [blocks, setBlocks] = useState(() =>
    (vacancy?.blocks.length ? vacancy.blocks : DEFAULT_BLOCKS.map((title) => ({ title, items: [] as string[] }))).map((b) => ({ title: b.title, items: b.items.join("\n") })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.title.trim()) return setError("Укажите должность");
    const input: VacancyInput = {
      ...f,
      is_active: vacancy?.is_active ?? true,
      blocks: blocks.map((b) => ({ title: b.title.trim(), items: b.items.split("\n").map((x) => x.trim()).filter(Boolean) })).filter((b) => b.title || b.items.length),
    };
    setBusy(true);
    try {
      if (vacancy) await adminApi.updateVacancy(vacancy.id, input);
      else await adminApi.createVacancy(input);
      toast.success(vacancy ? "Вакансия сохранена" : "Вакансия добавлена");
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Не удалось сохранить вакансию"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={vacancy ? vacancy.title : "Новая вакансия"} size="lg">
      <form onSubmit={save} className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
          <FieldLabel label="Должность" htmlFor="vc-title">
            <Input id="vc-title" value={f.title} onChange={set("title")} maxLength={200} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Отдел / магазин" htmlFor="vc-dept">
            <Input id="vc-dept" value={f.dept} onChange={set("dept")} maxLength={100} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Город" htmlFor="vc-city">
            <Input id="vc-city" value={f.city} onChange={set("city")} maxLength={100} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Опыт" htmlFor="vc-exp">
            <Input id="vc-exp" value={f.experience} onChange={set("experience")} placeholder="Опыт от 1 года" maxLength={100} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="График" htmlFor="vc-schedule">
            <Input id="vc-schedule" value={f.schedule} onChange={set("schedule")} maxLength={100} className={fieldCls} />
          </FieldLabel>
          <FieldLabel label="Зарплата" htmlFor="vc-salary">
            <Input id="vc-salary" value={f.salary} onChange={set("salary")} placeholder="от 5 000 с. / Договорная" maxLength={100} className={fieldCls} />
          </FieldLabel>
        </div>
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
          {blocks.map((b, i) => (
            <div key={i} className="flex flex-col gap-[6px]">
              <Input value={b.title} onChange={(e) => setBlocks((bs) => bs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={`Заголовок блока ${i + 1}`} maxLength={100} className={cn(fieldCls, "font-semibold")} />
              <Textarea
                value={b.items}
                onChange={(e) => setBlocks((bs) => bs.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)))}
                aria-label={`Пункты: ${b.title}`}
                placeholder="Каждый пункт — с новой строки"
                rows={7}
                className={cn(fieldCls, "h-auto py-[8px] text-[14px] leading-[20px]")}
              />
            </div>
          ))}
        </div>
        <ErrorLine error={error} />
        <div className="flex justify-end gap-[10px]">
          <Button variant="outline" className={btnCls} onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" className={btnCls} loading={busy}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
