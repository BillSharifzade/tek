// Единый шаблон страницы услуги (Figma «Сервис центр ДГУ» 10869:2975 / «Солнечная энергетика» 10980:2221).
// Контент каждой страницы — конфиг ServiceConfig (см. data.ts), вёрстка — ServiceTemplate.tsx.

export interface TitledText {
  title: string;
  text: string;
}

/** «Перечень работ»: подзаголовок + пункты списка. */
export interface WorkGroup {
  title: string;
  items: string[];
}

export interface PriceRow {
  label: string;
  value: string;
}

/** Строка фиолетовой плашки «Выезд специалиста»: обычный текст + жирное значение. */
export interface VisitLine {
  label: string;
  value: string;
}

/** Таб прайса (Figma «Прайс» 10957:2695, 10958:2057, 10961:2097, 10966:2173). */
export interface PriceTab {
  id: string;
  /** подпись таба в сегмент-меню */
  label: string;
  /** заголовок 32/22 SemiBold */
  title: string;
  /** «Перечень работ» — один или несколько блоков */
  groups?: WorkGroup[];
  /** вместо перечня — абзац 16/30 (#333) */
  text?: string;
  /** вместо перечня — HTML из CMS (для услуг без собственного конфига) */
  html?: string;
  /** кегль пунктов перечня (в макете «Обслуживание» — 14, в остальных табах — 15) */
  itemSize?: 14 | 15;
  /** жёлтая плашка с «!»: lead — жирный префикс («Сообщите заранее»), text — пояснение */
  notice?: { lead?: string; text: string };
  /** карточка справа */
  priceTitle: string;
  prices: PriceRow[];
  visit: { title: string; lines: VisitLine[] };
  footnote: string[];
}

export interface ScheduleTable {
  /** подпись в сегмент-навигации */
  navLabel: string;
  title: string;
  /** заголовок первой колонки («Расходные материалы и запчасти») */
  firstColumn: string;
  /** надзаголовок над колонками значений («Наработка в моточасах») */
  groupLabel: string;
  columns: string[];
  rows: { name: string; sup?: string; marks: boolean[] }[];
}

export interface ServiceConfig {
  slug: string;
  /** заголовок вкладки браузера / хлебных крошек */
  title: string;
  description: string;
  hero: {
    title: string;
    image: string;
    /** «contain» — для иллюстраций (svg из CMS), по умолчанию фото «cover» */
    imageFit?: "cover" | "contain";
    /** 4 пункта с зелёными галками, порядок: слева-сверху, справа-сверху, слева-снизу, справа-снизу */
    checks: string[];
  };
  /** жёлтая плашка с тремя преимуществами */
  advantages: TitledText[];
  tabs: PriceTab[];
  steps: TitledText[];
  /** серая полоса с фото и кнопкой */
  promo?: { title: string; text: string; image: string; cta: string; href?: string };
  /** полоса из 4 пунктов с чёрными галками */
  tips?: TitledText[];
  schedule?: ScheduleTable;
  faq: { q: string; a: string }[];
  /** подпись формы заявки: «Услуга: …» подставляется в примечание */
  requestSubject: string;
}
