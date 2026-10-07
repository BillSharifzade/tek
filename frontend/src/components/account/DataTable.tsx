import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** hide on narrow screens */
  hideBelow?: "sm" | "md" | "lg";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string | undefined;
  empty?: React.ReactNode;
  /** rows rendered before the data rows (e.g. opening balance) */
  prepend?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  dense?: boolean;
}

const alignCls = { left: "text-left", right: "text-right", center: "text-center" } as const;
const hideCls = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" } as const;

/** Cell paddings shared with custom prepend/footer rows. */
export const cellPad = "px-[10px] py-[12px]";

/**
 * Таблица ЛК (Figma 9097:650): без рамки, внутри белой карточки; шапка — Regular 15/23 #000 с отступом 10px,
 * линия #E5E5E5 в 31px от верха шапки; строки (15/20) разделены той же линией. На узких экранах — горизонтальный скролл.
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, prepend, footer, className, dense }: DataTableProps<T>) {
  const pad = dense ? "px-[10px] py-[8px]" : cellPad;
  return (
    <div className={cn("-mx-[20px] overflow-x-auto px-[20px] sm:mx-0 sm:px-0", className)}>
      <table className="w-full min-w-[640px] border-collapse text-[15px] leading-[20px]">
        <thead>
          <tr className="border-b border-line text-black">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("whitespace-nowrap px-[10px] pb-[8px] pt-0 font-normal leading-[23px]", alignCls[c.align ?? "left"], c.hideBelow && hideCls[c.hideBelow], c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prepend}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-[10px] py-[40px] text-center text-[#555]">
                {empty ?? "Нет данных"}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-b border-line", onRowClick && "cursor-pointer transition-colors hover:bg-surface-2")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("align-middle", pad, alignCls[c.align ?? "left"], c.hideBelow && hideCls[c.hideBelow], c.className)}>
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}
