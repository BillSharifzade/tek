import type { ScheduleTable as Schedule } from "./types";
import { IconTableCheck } from "./icons";

/**
 * «Периодичность ТО генераторов» — в макете это скриншот таблицы (to-table.png, 1259×404 на y=2542);
 * здесь она свёрстана HTML-таблицей с теми же размерами: шапка 78px #E4EAF0, строки 52px, чётные — #F5F7F9,
 * разделители #E4E8EC, текст #222D3A, колонки значений по 82.75px.
 */
export function ScheduleTable({ data }: { data: Schedule }) {
  const n = data.columns.length;
  // 9 колонок по 82.75px как в макете; при меньшем числе колонок та же общая ширина делится поровну
  const colW = (82.75 * 9) / Math.max(n, 1);
  return (
    <div className="scrollbar-none relative -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-[#222D3A] lg:ml-px lg:w-[1251px]">
        <colgroup>
          <col />
          {data.columns.map((c) => (
            <col key={c} style={{ width: `${colW}px` }} />
          ))}
        </colgroup>
        <thead className="bg-[#E4EAF0]">
          <tr className="h-[39px]">
            <th rowSpan={2} scope="col" className="pl-[5px] pt-[41px] text-left align-top text-[18.5px] font-bold leading-[20px]">
              {data.firstColumn}
            </th>
            <th colSpan={n} scope="colgroup" className="pt-[3px] align-top text-[18.5px] font-bold leading-[20px]">
              {data.groupLabel}
            </th>
          </tr>
          <tr className="h-[39px]">
            {data.columns.map((c) => (
              <th key={c} scope="col" className="pt-[2px] align-top text-[17px] font-bold leading-[20px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.name} className="h-[52px] border-b border-[#E4E8EC] even:bg-[#F5F7F9]">
              <th scope="row" className="pl-[5px] pt-[3px] text-left text-[17.5px] font-normal leading-[20px]">
                {r.name}
                {r.sup}
              </th>
              {r.marks.map((m, i) => (
                <td key={i} className="text-center align-middle">
                  {m ? (
                    <IconTableCheck className="inline-block -translate-x-[2.5px] align-middle text-[#222D3A]" />
                  ) : (
                    <span aria-hidden className="inline-block h-[2px] w-[18px] translate-y-[1.5px] bg-[#575F69] align-middle" />
                  )}
                  <span className="sr-only">{m ? "да" : "нет"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
