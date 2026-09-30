import { PASSWORD_RULES, checkPassword } from "@/lib/password";
import { cn } from "@/lib/cn";

/** Правила пароля из макета «Личные данные» (9085:409): 12/18 #666; по мере ввода выполненные — зелёные, невыполненные — красные. */
export function PasswordRules({ password, userName, className }: { password: string; userName?: string; className?: string }) {
  const results = checkPassword(password, userName);
  return (
    <ul className={cn("px-[13px] text-[12px] leading-[18px] text-sub", className)} aria-label="Требования к паролю">
      {PASSWORD_RULES.map((rule, i) => (
        <li key={rule} className={cn(password && (results[i] ? "text-[#00A000]" : "text-sale-text"))}>
          {rule}
        </li>
      ))}
    </ul>
  );
}
