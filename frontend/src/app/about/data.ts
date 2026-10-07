// Контент страницы «О компании» (структура и тексты — с tectj.com/company, /company/jobs).

export const FACTS: { value: string; label: string }[] = [
  { value: "100+", label: "выполненных проектов" },
  { value: "1000+", label: "наименований товаров" },
  { value: "50+", label: "дилеров по стране" },
  { value: "7", label: "инженеров в штате" },
];

export const HIGHLIGHTS = ["Прямые поставки", "Склад в Душанбе", "Своя доставка", "Инженерная поддержка"];

export const ADVANTAGES: { icon: number; title: string; text: string }[] = [
  { icon: 1, title: "Свобода выбора", text: "Более 10 брендов на разный бюджет, производящих по российским и европейским стандартам." },
  { icon: 2, title: "Пред- и постпродажный сервис", text: "Техническая поддержка на всех этапах — от подбора оборудования до ввода в эксплуатацию." },
  { icon: 3, title: "Большой склад", text: "Самый большой склад медных кабелей, кабеленесущих систем и дизельных генераторов в Таджикистане." },
  { icon: 4, title: "Гибкость и комплексность", text: "Изучим индивидуальные пожелания и предложим решение под ключ для сложных проектов." },
];

/** «Ключевой ассортимент»: категория каталога + фото с tectj.com (public/corporate/range). */
export const RANGE: { slug: string; name: string; img: number }[] = [
  { slug: "kabeli-i-provoda", name: "Кабели и провода", img: 1 },
  { slug: "generatory", name: "Генераторы", img: 2 },
  { slug: "transformatory", name: "Трансформаторы", img: 3 },
  { slug: "kabelenesushchie-sistemy", name: "Кабеленесущие системы", img: 4 },
  { slug: "svetotekhnika", name: "Светотехника", img: 5 },
  { slug: "shchitovoe-oborudovanie", name: "Щитовое оборудование", img: 6 },
];
