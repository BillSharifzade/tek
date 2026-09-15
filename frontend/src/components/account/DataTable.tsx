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

/** Simple responsive table (horizontal scroll on narrow screens). */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, prepend, footer, className, dense }: DataTableProps<T>) {
  const pad = dense ? "px-3 py-2" : "px-4 py-3";
  return (
    <div className={cn("overflow-x-auto rounded-[8px] border border-line bg-white", className)}>
      <table className="w-full min-w-[640px] border-collapse text-base">
        <thead>
          <tr className="bg-surface text-sm text-sub">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("whitespace-nowrap font-medium", pad, alignCls[c.align ?? "left"], c.hideBelow && hideCls[c.hideBelow], c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prepend}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sub">
                {empty ?? "Нет данных"}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-t border-line", onRowClick && "cursor-pointer transition-colors hover:bg-surface-2")}
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
