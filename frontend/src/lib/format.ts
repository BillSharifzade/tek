const CURRENCY_SUFFIX = " с.";

const nfMoney = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const nfQty = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
  useGrouping: true,
});

const nfInt = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** Intl inserts NBSP/narrow NBSP as the thousands separator; normalise to a regular NBSP. */
function normalizeSpaces(s: string): string {
  return s.replace(/[  ]/g, " ");
}

/** 1690.8 → "1 690,80 с." */
export function money(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return normalizeSpaces(nfMoney.format(Number.isFinite(n) ? n : 0)) + CURRENCY_SUFFIX;
}

/** 1690.8 → "1 690,80" (без суффикса) */
export function moneyBare(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return normalizeSpaces(nfMoney.format(Number.isFinite(n) ? n : 0));
}

/** 100055 → "100 055" ; 12.5 → "12,5" */
export function qty(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return normalizeSpaces(nfQty.format(Number.isFinite(n) ? n : 0));
}

export function int(value: number | null | undefined): string {
  return normalizeSpaces(nfInt.format(value ?? 0));
}

/** "2025-08-10" | ISO timestamp → "10.08.2025" */
export function date(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** "2025-08-10" → "10/08/2025" (формат полей периода) */
export function dateSlash(value: string | Date | null | undefined): string {
  return date(value).replaceAll(".", "/");
}

/** Date → "2025-08-10" for inputs / API */
export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** "2025-09-09" → "9 сентября" */
export function dayMonth(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** Russian plural helper: plural(3, ["товар", "товара", "товаров"]) → "товара" */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function countLabel(n: number, forms: [string, string, string]): string {
  return `${int(n)} ${plural(n, forms)}`;
}

export const unitLabel = (unit: string) => (unit === "м" ? "за метр" : "за шт");

export function percent(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")}%`;
}

export function phoneHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}
