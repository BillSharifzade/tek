/** Телефон во всех формах сайта — только +992 и 9 цифр номера, без пробелов и скобок: +992921112225. */
export const PHONE_PREFIX = "+992";
const NATIONAL_DIGITS = 9;

/**
 * Приводит ввод к виду +992XXXXXXXXX: оставляет только цифры, код страны не дублирует (вставка «+992 92 111 22 25»
 * или «921112225» дают одно и то же), лишние цифры отрезает. Стёртый до префикса номер оставляет префикс.
 */
export function normalizePhone(raw: string): string {
  const s = raw.trim();
  if (PHONE_PREFIX.startsWith(s)) return PHONE_PREFIX;
  let digits = s.replace(/\D/g, "");
  if (s.startsWith(PHONE_PREFIX)) digits = digits.slice(3);
  // вставка полного номера в поле, где уже стоит +992 («+992+992 92 111 22 25», «+992992921112225»), — код страны второй раз не берём
  if (digits.length >= NATIONAL_DIGITS + 3 && digits.startsWith("992")) digits = digits.slice(3);
  return PHONE_PREFIX + digits.slice(0, NATIONAL_DIGITS);
}

export function isValidPhone(value: string): boolean {
  return /^\+992\d{9}$/.test(value.trim());
}

/** Значение для поля из сохранённого номера (профиль, компания): номера +992 — в единый формат, прочие — как есть. */
export function phoneForField(value: string | null | undefined): string {
  if (!value) return "";
  return /^\+?\s*992/.test(value.trim()) || /^\d{9}$/.test(value.replace(/\D/g, "")) ? normalizePhone(value) : value;
}

export const PHONE_ERROR = "Укажите номер в формате +992XXXXXXXXX";

/**
 * Пропсы поля телефона: пустое поле показывает плейсхолдер, при фокусе подставляется +992, ввод — только цифры.
 * `onValue` получает уже нормализованное значение.
 */
export function phoneInputProps(value: string, onValue: (v: string) => void) {
  return {
    type: "tel" as const,
    inputMode: "numeric" as const,
    autoComplete: "tel",
    value,
    onFocus: () => {
      if (!value) onValue(PHONE_PREFIX);
    },
    onBlur: () => {
      if (value === PHONE_PREFIX) onValue("");
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValue(normalizePhone(e.target.value)),
  };
}
