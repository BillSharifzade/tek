import { readFile } from "node:fs/promises";
import path from "node:path";
import { breaker, cable, lamp, plain, relabel, tag, wire } from "./draw";

/**
 * Иллюстрации исполнений товара (пути генерирует бэкенд, seed.rs → variant_images):
 *   /art/breaker/{полюса}/{C16}.svg        /art/cable/{жилы}/{сечение}.svg
 *   /art/wire/{цвет}/{сечение}.svg         /art/lamp/{цоколь}/{температура}/{мощность}.svg
 *   /art/label/{категория}/{подпись}.svg   /art/tag/{категория}/{ось: значение|…}.svg
 * Ответ детерминирован по URL — кешируется браузером и CDN.
 */
const svgResponse = (svg: string) =>
  new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function categoryArt(cat: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(cat)) return null;
  try {
    return await readFile(path.join(process.cwd(), "public", "products", `${cat}.svg`), "utf8");
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/art/[...path]">) {
  const parts = (await ctx.params).path.map((p) => decodeURIComponent(p));
  const last = parts.length - 1;
  if (last < 0 || !parts[last].endsWith(".svg")) return new Response("Not found", { status: 404 });
  parts[last] = parts[last].slice(0, -4);
  const [kind, a = "", b = "", c = ""] = parts;

  switch (kind) {
    case "breaker":
      return svgResponse(breaker(parseInt(a, 10) || 1, b));
    case "cable":
      return svgResponse(cable(parseInt(a, 10) || 1, b));
    case "wire":
      return svgResponse(wire(a, b));
    case "lamp":
      return svgResponse(lamp(a, b, c));
    case "label": {
      const base = await categoryArt(a);
      return svgResponse(base ? relabel(base, b) : plain(b));
    }
    case "tag":
      return svgResponse(
        tag(
          b
            .split("|")
            .map((l) => l.split(": ") as [string, string?])
            .filter((l): l is [string, string] => Boolean(l[1])),
        ),
      );
    default:
      return new Response("Not found", { status: 404 });
  }
}
