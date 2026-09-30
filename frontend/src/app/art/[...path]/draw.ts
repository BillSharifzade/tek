import { swatch } from "@/lib/colors";

/**
 * Иллюстрации исполнений товара в стиле картинок каталога (/public/products/*.svg): 600×600, серая плашка r32,
 * жёлтый круг, тёмные #3F3F3F линии с жёлтыми акцентами и тёмный ярлык справа внизу.
 * Для автоматов, кабелей, проводов и ламп рисунок отражает исполнение — фото меняется вместе с выбором.
 */

const INK = "#3F3F3F";
const ACCENT = "#F4C241";
const COPPER = "#D38B45";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** «2.5» → «2,5» */
const ru = (n: string) => n.replace(".", ",");

function frame(body: string, badge: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" fill="none"><rect width="600" height="600" fill="#FFFFFF"/><rect x="60" y="60" width="480" height="480" rx="32" fill="#F6F6F6"/><circle cx="440" cy="160" r="90" fill="${ACCENT}" opacity=".22"/>${body}${badgeSvg(badge)}</svg>`;
}

/** Тёмный ярлык справа внизу, ширина по тексту (как на картинках каталога, но не уже 150px). */
export function badgeSvg(text: string): string {
  if (!text) return "";
  const size = text.length > 22 ? 16 : 20;
  const w = Math.min(460, Math.max(150, Math.round(text.length * size * 0.6 + 36)));
  const x = 530 - w;
  return `<rect x="${x}" y="470" width="${w}" height="44" rx="10" fill="${INK}"/><text x="${x + w / 2}" y="${size > 16 ? 499 : 497}" font-family="Roboto, Inter, Arial" font-size="${size}" font-weight="700" fill="${ACCENT}" text-anchor="middle">${esc(text)}</text>`;
}

/** Модульный автомат: N полюсов в ряд, у многополюсного — общая перемычка рукояток. */
export function breaker(poles: number, label: string): string {
  const n = Math.min(Math.max(poles, 1), 4);
  const w = 80;
  const h = 290;
  const x0 = 290 - (n * w) / 2;
  const y0 = 135;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w;
    body += `<rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/>`;
    body += `<path d="M${x + 14} ${y0 + 26} h${w - 28} M${x + 14} ${y0 + h - 26} h${w - 28}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    body += `<rect x="${x + 20}" y="${y0 + 80}" width="${w - 40}" height="92" rx="6" fill="${INK}"/><rect x="${x + 26}" y="${y0 + 87}" width="${w - 52}" height="36" rx="4" fill="${ACCENT}"/>`;
    body += `<text x="${x + w / 2}" y="${y0 + 218}" font-family="Roboto, Inter, Arial" font-size="20" font-weight="700" fill="${INK}" text-anchor="middle">${esc(label)}</text>`;
  }
  if (n > 1) body += `<rect x="${x0 + 26}" y="${y0 + 100}" width="${n * w - 52}" height="11" rx="5.5" fill="${INK}"/>`;
  return frame(body, `${n}P ${label}`);
}

/** Цвета изоляции жил силового кабеля (N, L1, L2, L3, PE); у контрольного жилы белые с номерами. */
const CORE_COLORS = ["#8B5A2B", "#2B2B2B", "#9AA0A6", "#3381D5", "pe"];

function coreCenters(n: number, R: number): { r: number; pts: [number, number][] } {
  if (n === 1) return { r: R * 0.7, pts: [[0, 0]] };
  if (n <= 5) {
    const s = Math.sin(Math.PI / n);
    const r = (R * s) / (1 + s);
    const ring = R - r;
    return { r: r * 0.96, pts: Array.from({ length: n }, (_, i) => [ring * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), ring * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]) };
  }
  // гексагональная укладка слоями 1 + 6 + 12 + 18…
  let layers = 1;
  let cap = 1;
  while (cap < n) {
    cap += 6 * layers;
    layers++;
  }
  const r = R / (2 * layers - 1 + 0.25);
  const pts: [number, number][] = [[0, 0]];
  for (let k = 1; pts.length < n; k++) {
    const count = Math.min(6 * k, n - pts.length);
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count - Math.PI / 2;
      pts.push([2 * k * r * Math.cos(a), 2 * k * r * Math.sin(a)]);
    }
  }
  return { r: r * 0.95, pts };
}

/** Срез кабеля: оболочка, жилы с изоляцией по цветам и медь; уходящий назад «хвост» кабеля. */
export function cable(cores: number, section: string): string {
  const n = Math.min(Math.max(cores, 1), 37);
  const cx = 245;
  const cy = 275;
  const R = 128;
  const { r, pts } = coreCenters(n, R - 22);
  const cu = Math.min(0.72, 0.42 + Math.sqrt(Number(section) || 1) * 0.05);
  let body = `<path d="M${cx} ${cy - R} L${cx + 150} ${cy - R + 60} A${R} ${R} 0 0 1 ${cx + 150} ${cy + R + 60} L${cx} ${cy + R} Z" fill="#2E2E2E"/>`;
  body += `<path d="M${cx + 50} ${cy - R + 22} L${cx + 165} ${cy - R + 68}" stroke="#5A5A5A" stroke-width="8" stroke-linecap="round"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#262626"/><circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="#E9E9E9"/>`;
  pts.forEach(([x, y], i) => {
    const color = n > 5 ? "#FFFFFF" : CORE_COLORS[n === 2 ? [0, 3][i] : n === 3 ? [0, 3, 4][i] : n === 4 ? [0, 1, 2, 4][i] : i] ?? "#FFFFFF";
    const X = cx + x;
    const Y = cy + y;
    if (color === "pe") {
      body += `<circle cx="${X}" cy="${Y}" r="${r}" fill="#00A651"/><path d="M${X - r} ${Y} A${r} ${r} 0 0 1 ${X + r} ${Y} Z" fill="#FFD400"/>`;
    } else {
      body += `<circle cx="${X}" cy="${Y}" r="${r}" fill="${color}" stroke="#BDBDBD" stroke-width="1.5"/>`;
    }
    body += `<circle cx="${X}" cy="${Y}" r="${r * cu}" fill="${COPPER}"/><circle cx="${X - r * cu * 0.3}" cy="${Y - r * cu * 0.3}" r="${r * cu * 0.35}" fill="#F0B27A" opacity=".7"/>`;
  });
  return frame(body, `${n}×${ru(section)} мм²`);
}

/** Бухта одножильного провода нужного цвета с зачищенным концом. */
export function wire(colorName: string, section: string): string {
  const colors = swatch(colorName);
  const c1 = colors[0] ?? "#9AA0A6";
  const c2 = colors[1];
  const sw = Math.min(26, 10 + Math.sqrt(Number(section) || 1) * 3.2);
  const light = /^#F[0-9A-F]F/i.test(c1);
  // витки разделены контуром: серым у светлой изоляции, цветом плашки у тёмной
  const edge = light ? "#A9AEB6" : "#F6F6F6";
  const outline = `stroke="${edge}" stroke-width="${sw + 5}"`;
  let body = "";
  const defs = c2
    ? `<defs><pattern id="pe" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="36" height="36" fill="${c2}"/><rect width="18" height="36" fill="${c1}"/></pattern></defs>`
    : "";
  const paint = c2 ? "url(#pe)" : c1;
  for (let i = 0; i < 5; i++) {
    const rx = 150 - i * 5;
    const ry = 88 - i * 3;
    const cy = 250 + i * 14;
    body += `<ellipse cx="290" cy="${cy}" rx="${rx}" ry="${ry}" ${outline}/>`;
    body += `<ellipse cx="290" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${paint}" stroke-width="${sw}"/>`;
  }
  const tail = `M${290 + 145} ${306} C 470 360, 460 410, 400 420`;
  body += `<path d="${tail}" stroke="${edge}" stroke-width="${sw + 5}" stroke-linecap="round" fill="none"/>`;
  body += `<path d="${tail}" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  body += `<path d="M400 420 L345 428" stroke="${COPPER}" stroke-width="${Math.max(5, sw * 0.55)}" stroke-linecap="round"/>`;
  return frame(defs + body, `1×${ru(section)} мм²`);
}

/** Светодиодная лампа: форма и цоколь по E27/E14, свечение по цветовой температуре. */
export function lamp(base: string, temp: string, watt: string): string {
  const k = parseInt(temp, 10) || 4000;
  const glow = k <= 3000 ? "#FFC35A" : k <= 4000 ? "#FFE9A8" : "#CFE3FF";
  const glass = k <= 3000 ? "#FFE3A3" : k <= 4000 ? "#FFF6D9" : "#EEF5FF";
  const small = /14/.test(base);
  const s = small ? 0.8 : 1;
  const cx = 290;
  const top = 130;
  const bulb = small
    ? `M${cx} ${top + 20} C ${cx + 70} ${top + 90}, ${cx + 62} ${top + 190}, ${cx + 44} ${top + 230} L ${cx - 44} ${top + 230} C ${cx - 62} ${top + 190}, ${cx - 70} ${top + 90}, ${cx} ${top + 20} Z`
    : `M${cx} ${top} a 118 118 0 0 1 64 217 l -8 30 h -112 l -8 -30 a 118 118 0 0 1 64 -217 z`;
  const neckY = small ? top + 230 : top + 247;
  const bw = 88 * s;
  let body = `<defs><radialGradient id="g" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>`;
  body += `<circle cx="${cx}" cy="${top + 110}" r="${small ? 150 : 185}" fill="url(#g)"/>`;
  body += `<path d="${bulb}" fill="${glass}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
  body += `<path d="M${cx - 26} ${top + 120} l 26 -34 l 26 34" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
  for (let i = 0; i < 4; i++) {
    const y = neckY + 8 + i * 17 * s;
    const w = bw - i * 6 * s;
    body += `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${12 * s}" rx="${5 * s}" fill="${i % 2 ? "#9AA0A6" : "#C7CBD1"}" stroke="${INK}" stroke-width="3"/>`;
  }
  body += `<path d="M${cx - 16 * s} ${neckY + 8 + 4 * 17 * s} h ${32 * s} l -8 ${16 * s} h ${-16 * s} z" fill="${INK}"/>`;
  body += `<text x="${cx}" y="${top + (small ? 160 : 150)}" font-family="Roboto, Inter, Arial" font-size="${small ? 24 : 30}" font-weight="700" fill="${INK}" text-anchor="middle">${esc(watt)}W</text>`;
  return frame(body, `${base} · ${temp}`);
}

/** Карточка каталога с подписью исполнения вместо общего ярлыка. */
export function relabel(svg: string, label: string): string {
  const cleaned = svg.replace(/<rect x="380" y="470"[^>]*\/><text[^>]*>[^<]*<\/text>/, "");
  return cleaned.replace(/<\/svg>\s*$/, `${badgeSvg(label)}</svg>`);
}

/** Пустая карточка с подписью — если у категории нет своей картинки. */
export function plain(label: string): string {
  return frame(`<rect x="200" y="170" width="200" height="200" rx="24" stroke="${INK}" stroke-width="6"/><path d="M240 330 l40 -50 l30 30 l50 -60" stroke="${ACCENT}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`, label);
}

/** «Шильдик» исполнения: жёлтая шапка и параметры строками «ось — значение». */
export function tag(lines: [string, string][]): string {
  const rows = lines.slice(0, 5);
  const h = 150 + rows.length * 64;
  const y0 = 300 - h / 2;
  let body = `<rect x="110" y="${y0}" width="380" height="${h}" rx="18" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/>`;
  body += `<path d="M113 ${y0 + 18} a15 15 0 0 1 15 -15 h344 a15 15 0 0 1 15 15 v58 h-374 z" fill="${ACCENT}"/>`;
  body += `<circle cx="146" cy="${y0 + 42}" r="9" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>`;
  body += `<text x="170" y="${y0 + 51}" font-family="Roboto, Inter, Arial" font-size="24" font-weight="800" fill="${INK}">ИСПОЛНЕНИЕ</text>`;
  rows.forEach(([k, v], i) => {
    const y = y0 + 124 + i * 64;
    body += `<text x="140" y="${y}" font-family="Roboto, Inter, Arial" font-size="17" fill="#808080">${esc(k.length > 34 ? `${k.slice(0, 33)}…` : k)}</text>`;
    body += `<text x="140" y="${y + 28}" font-family="Roboto, Inter, Arial" font-size="${v.length > 22 ? 20 : 26}" font-weight="700" fill="${INK}">${esc(v.length > 30 ? `${v.slice(0, 29)}…` : v)}</text>`;
    if (i < rows.length - 1) body += `<path d="M140 ${y + 44} h320" stroke="#E5E5E5" stroke-width="2"/>`;
  });
  return frame(body, "");
}
