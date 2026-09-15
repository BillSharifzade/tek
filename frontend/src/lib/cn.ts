import { twMerge } from "tailwind-merge";

export type ClassValue = string | number | bigint | null | undefined | false | ClassValue[] | Record<string, boolean | null | undefined>;

function flatten(inputs: ClassValue[]): string[] {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (typeof v === "object") {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k);
    }
  };
  for (const i of inputs) walk(i);
  return out;
}

/** classnames + tailwind-merge: later classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(flatten(inputs).join(" "));
}
