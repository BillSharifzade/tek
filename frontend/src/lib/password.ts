export const PASSWORD_RULES = [
  "Не менее 8 символов.",
  "Буквы латинского алфавита.",
  "Как минимум одна буква и цифра.",
  "Не допускается имя пользователя.",
] as const;

/** Returns true for each rule that passes, in the same order as PASSWORD_RULES. */
export function checkPassword(password: string, userName = ""): boolean[] {
  const p = password;
  const latinOnly = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]*$/.test(p) && p.length > 0;
  const hasLetterAndDigit = /[A-Za-z]/.test(p) && /\d/.test(p);
  const local = userName.split("@")[0]?.trim().toLowerCase();
  const noUserName = !local || local.length < 3 || !p.toLowerCase().includes(local);
  return [p.length >= 8, latinOnly, hasLetterAndDigit, noUserName];
}

export function passwordValid(password: string, userName = ""): boolean {
  return checkPassword(password, userName).every(Boolean);
}
