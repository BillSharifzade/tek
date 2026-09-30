/** Цвета для свотчей торговых предложений и иллюстраций исполнений (провод, розетка…). */
const COLORS: Record<string, string> = {
  красный: "#FF0000",
  зелёный: "#00BA00",
  зеленый: "#00BA00",
  синий: "#3381D5",
  голубой: "#33B5E5",
  жёлтый: "#FFCC33",
  желтый: "#FFCC33",
  фиолетовый: "#8A38F5",
  белый: "#F6F7F8",
  бежевый: "#E9DCC3",
  серый: "#9AA0A6",
  чёрный: "#000000",
  черный: "#000000",
  оранжевый: "#FF8A00",
  коричневый: "#8B5A2B",
};

/** «белая» / «белое» / «жёлто» → «белый» / «жёлтый»; «синяя» → «синий». */
function base(word: string): string {
  if (COLORS[word]) return word;
  const candidates = [word.replace(/(ая|ое|ые|о)$/, "ый"), word.replace(/(яя|ее|ие|е)$/, "ий"), word.replace(/(ая|ое|ые|о)$/, "ой")];
  return candidates.find((c) => COLORS[c]) ?? word;
}

/** «жёлто-зелёный» → две половинки; пустой массив — цвет не распознан. */
export function swatch(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[-/ ]+/)
    .map((w) => COLORS[base(w)] ?? null)
    .filter((c): c is string => Boolean(c));
}
