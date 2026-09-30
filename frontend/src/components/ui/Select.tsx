import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  invalid?: boolean;
}

/** Выпадающий список в стиле полей макета: 36px, рамка #D9DDE4, r5, 14px; уголок — треугольник шапки (#666). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, className, invalid, ...rest }, ref) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        className={cn(
          "block h-[36px] w-full cursor-pointer appearance-none rounded-[5px] border border-line-3 bg-white pb-[2px] pl-[13px] pr-[32px] text-[14px] leading-[20px] text-black transition-colors hover:border-outline focus:border-outline-hover focus:outline-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-sub",
          invalid && "border-sale hover:border-sale",
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width={8} height={4} viewBox="0 0 8.07 4.04" className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-sub" aria-hidden>
        <path d="M0 0H8.07L4.035 4.035Z" fill="currentColor" />
      </svg>
    </div>
  );
});
