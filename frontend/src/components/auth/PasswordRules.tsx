import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES, checkPassword } from "@/lib/password";
import { cn } from "@/lib/cn";

export function PasswordRules({ password, userName }: { password: string; userName?: string }) {
  const results = checkPassword(password, userName);
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm" aria-label="Требования к паролю">
      {PASSWORD_RULES.map((rule, i) => {
        const ok = password.length > 0 && results[i];
        return (
          <li key={rule} className={cn("flex items-center gap-2", ok ? "text-success" : "text-sub")}>
            {ok ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-2 fill-current text-muted" strokeWidth={0} />}
            {rule}
          </li>
        );
      })}
    </ul>
  );
}
