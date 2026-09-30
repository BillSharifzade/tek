// Каталоги и брошюры производителей (tectj.com/podderzhka/katalogi-i-broshyury): PDF на сервере tectj.com,
// обложки — public/corporate/catalogs/<n>.webp.

export const CATALOG_BRANDS: { slug: string; name: string }[] = [
  { slug: "dks", name: "ДКС" },
  { slug: "aksa", name: "AKSA" },
  { slug: "philips-lighting", name: "Philips Lighting" },
  { slug: "prysmian", name: "Prysmian" },
  { slug: "te-connectivity", name: "TE Connectivity" },
  { slug: "omicron", name: "Omicron" },
  { slug: "sata-tools", name: "SATA Tools" },
];

export interface CatalogDoc {
  n: number;
  brand: string;
  name: string;
  file: string;
}

export const CATALOGS: CatalogDoc[] = [
  { n: 21, brand: "dks", name: "EOS Charge высокотехнологичная линейка зарядных станций для электромобилей", file: "https://tectj.com/upload/iblock/0e8/x8wup0ri6sd74vm36ub14tha6pmeh2l9.pdf" },
  { n: 22, brand: "dks", name: "Взрывозащищенное оборудование", file: "https://tectj.com/upload/iblock/f54/3aif6tyf3c8up8i04jxo47bzmiz5901h.pdf" },
  { n: 23, brand: "dks", name: "Кабеленесущие системы. Молниезащита и заземление. Электроустановочные изделия. Модульные щитки", file: "https://tectj.com/upload/iblock/e37/6wlxfpw18xp717929wmpp2lh938yjags.pdf" },
  { n: 24, brand: "dks", name: "Каталог для систем автоматизации", file: "https://tectj.com/upload/iblock/c35/a51895esvivr89cktrno35a2ga4o74i9.pdf" },
  { n: 25, brand: "dks", name: "Решения для IT инфраструктуры", file: "https://tectj.com/upload/iblock/c1c/pbfi1xb5lbz8n6fn3vfenf42be89jwyn.pdf" },
  { n: 26, brand: "dks", name: "Каталог решений для систем распределения энергии", file: "https://tectj.com/upload/iblock/8d2/lo6yvpo46h7y2ljs8grg59u0nu7iji3c.pdf" },
  { n: 27, brand: "dks", name: "DKC-2022.EC Типовые узлы прокладки инженерных коммуникаций", file: "https://tectj.com/upload/iblock/bee/pmk6vbmhpzdnqph7fmv12tpb0tozf08h.pdf" },
  { n: 28, brand: "dks", name: "DKC-2021.PT Шинопроводы Hercules 630–6300 A и DKC-2021.DT Шинопроводы Hercules 160–800 A", file: "https://tectj.com/upload/iblock/7c2/3edhk3mx2rtq8uk9ljd3ut1wpx6h7b4z.pdf" },
  { n: 29, brand: "dks", name: "DKC-2017.T5 Система модульных эстакад T5 Combitech", file: "https://tectj.com/upload/iblock/02d/nz2pcivlpyeur7t4x15inp59cyigyvja.pdf" },
  { n: 30, brand: "dks", name: "А12-2022 Прокладка кабелей с применением модульных кабельных колодцев и двустенных гофрированных труб", file: "https://tectj.com/upload/iblock/bb6/3bvnffstsut6brmjrqxwnn4t6lx40xux.pdf" },
  { n: 31, brand: "dks", name: "DKC-2021.COMBITECH Опорные конструкции, узлы монтажа лотков и аксессуаров", file: "https://tectj.com/upload/iblock/00b/drr5f1t53cfxcb7157lqx2dhqu9lu7n9.pdf" },
  { n: 32, brand: "dks", name: "DKC-2023.RF Система фальшпола", file: "https://tectj.com/upload/iblock/eef/jvcfnos5zfid3ob33629z3qvf5bvgfja.pdf" },
  { n: 33, brand: "dks", name: "DKC-2024.Cosmec Система металлических труб и металлорукава Cosmec", file: "https://tectj.com/upload/iblock/4ba/i4e4kbp882lrs7u5hex3hre0t1hx8qpw.pdf" },
  { n: 34, brand: "dks", name: "DKC-2020.A Система взрывозащищенного электрооборудования ARMEX", file: "https://tectj.com/upload/iblock/377/3r1zm0p5qmlhpc1bwts6bmixy2l1iffj.pdf" },
  { n: 35, brand: "dks", name: "DKC-2023.J Система молниезащиты и заземления Jupiter", file: "https://tectj.com/upload/iblock/372/kqs9ue29q36hx49sp4ahimonpx7neuno.pdf" },
  { n: 36, brand: "dks", name: "DKC-2018.IS Проектирование кабеленесущих конструкций", file: "https://tectj.com/upload/iblock/45d/jwk2qamyd929zcbpxdqcet73g2ao2r95.pdf" },
  { n: 37, brand: "dks", name: "Альбом типовых решений НКУ", file: "https://tectj.com/upload/iblock/eb8/42rhnlpfgl5oavqcwlsr7tnlckx1r8tb.pdf" },
  { n: 38, brand: "dks", name: "Готовые решения НКУ до 630 А в корпусах ST", file: "https://tectj.com/upload/iblock/1c6/v969pdsmz8eg1oabc7h101h0v6q2u5c5.pdf" },
  { n: 7, brand: "aksa", name: "Корпоративная презентация", file: "https://tectj.com/upload/iblock/4ad/x8qog8t5z88msap2u7d2wm8deehp95r1.pdf" },
  { n: 8, brand: "aksa", name: "Стационарные генераторы AKSA", file: "https://tectj.com/upload/iblock/963/4s8acd40v1vas070r5c9wttipn3in5i4.pdf" },
  { n: 9, brand: "aksa", name: "Портативные генераторы AKSA", file: "https://tectj.com/upload/iblock/27b/dhngutshn2ye6zt2lfstuxq7b0ozuvyd.pdf" },
  { n: 10, brand: "philips-lighting", name: "Архитектурное освещение", file: "https://tectj.com/upload/iblock/c9d/xkccsi2tugvf6okyeyce9p5mxuwqroyz.pdf" },
  { n: 11, brand: "philips-lighting", name: "Освещение для аэропортов", file: "https://tectj.com/upload/iblock/457/rbdlt9xxlavvjx3y9u7thdauzqyuqka2.pdf" },
  { n: 12, brand: "philips-lighting", name: "Освещение пром. предприятий", file: "https://tectj.com/upload/iblock/81b/jvz4vkdx49nc4cuys8rwct52gikkh1i3.pdf" },
  { n: 13, brand: "philips-lighting", name: "Базовый ассортимент светильников", file: "https://tectj.com/upload/iblock/612/y0gbr1m0hmmd690383wlzoanxlqjl701.pdf" },
  { n: 14, brand: "philips-lighting", name: "Освещение для розничной торговли", file: "https://tectj.com/upload/iblock/7f0/4pnvi2x36z2ok6j7p1m6mydrom9ixhxo.pdf" },
  { n: 15, brand: "philips-lighting", name: "Освещение спортивных объектов", file: "https://tectj.com/upload/iblock/d7f/l3tg0bqk8xin03pdr2eniud4prazn225.pdf" },
  { n: 16, brand: "philips-lighting", name: "Освещение для дорог и парков", file: "https://tectj.com/upload/iblock/65e/jjgcj98hkipr7m1y0elhj4fh68js9znp.pdf" },
  { n: 19, brand: "prysmian", name: "Силовые кабели", file: "https://tectj.com/upload/iblock/575/1e1ohanjxc6uhuccxq3w8baiffk4801h.pdf" },
  { n: 20, brand: "prysmian", name: "Телекоммуникационные кабели", file: "https://tectj.com/upload/iblock/e50/b45sn7iue2tal9xu0gooww9n73444i1n.pdf" },
  { n: 17, brand: "te-connectivity", name: "Кабельная арматура до 35кВ", file: "https://tectj.com/upload/iblock/289/o5clurk3894hw77r5jf1la8d9yp3de09.pdf" },
  { n: 18, brand: "te-connectivity", name: "Высоковольтная кабельная арматура Райхем", file: "https://tectj.com/upload/iblock/03d/j5z9l80ek9wsm9cpsqjn8s4hin9olceq.pdf" },
  { n: 1, brand: "omicron", name: "FRANEO 800", file: "https://tectj.com/upload/iblock/3e4/52xybekpebms7zuow4zt8ern9ajocnq2.pdf" },
  { n: 2, brand: "omicron", name: "DIRANA", file: "https://tectj.com/upload/iblock/9af/o5m3j7beqflbd2oghl18tb6tgl8060h3.pdf" },
  { n: 3, brand: "omicron", name: "CT Analyzer", file: "https://tectj.com/upload/iblock/a70/cc0izme1v372hpoud7lws12ingggdsy2.pdf" },
  { n: 4, brand: "omicron", name: "CIBANO 500", file: "https://tectj.com/upload/iblock/ffc/2v3hll51lf0fjazffw3lbd8pf630pmdp.pdf" },
  { n: 5, brand: "omicron", name: "CMC 500", file: "https://tectj.com/upload/iblock/549/ie80dlbob12frsj430bvo1j2ijfgim9t.pdf" },
  { n: 6, brand: "omicron", name: "CPC 100", file: "https://tectj.com/upload/iblock/830/2r8f37794eqeg7j712hqoj9exy94appm.pdf" },
  { n: 39, brand: "sata-tools", name: "Инструменты", file: "https://tectj.com/upload/iblock/cbc/b33ek45csie49xebkw4l658i4fkovb8b.pdf" },
];
