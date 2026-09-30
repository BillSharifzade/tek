import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { SITE } from "@/lib/site";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, SectionTitle, Lead } from "@/components/content/PageHead";
import { AnchorTabs } from "@/components/content/AnchorTabs";
import { Prose } from "@/components/content/Prose";
import { Faq, type FaqItem } from "@/components/content/Faq";
import { ContactForm } from "@/components/content/ContactForm";
import { CheckPoints, InfoPanel, Note, PriceCard, Steps } from "@/components/content/Blocks";
import { IconCube, IconTruck, IconUserCircle } from "@/components/content/icons";
import type { CmsPage } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Покупателям",
  description: "Как купить в ТЭК, условия доставки и оплаты, гарантия и ответы на частые вопросы.",
};

const TABS = [
  { id: "how-to-buy", label: "Как купить" },
  { id: "delivery", label: "Доставка" },
  { id: "payment", label: "Оплата" },
  { id: "warranty", label: "Гарантия" },
  { id: "faq", label: "Вопросы и ответы" },
];

const STEPS = [
  { title: "Найдите товар", text: "В каталоге или поиском по коду, наименованию и бренду." },
  { title: "Добавьте в корзину", text: "Укажите количество, сохраните смету в Excel или поделитесь корзиной." },
  { title: "Оформите заказ", text: "Выберите доставку или самовывоз и удобный способ оплаты." },
  { title: "Получите заказ", text: "Менеджер подтвердит заказ, доставим за 1 рабочий день." },
];

const DELIVERY_RULES = [
  "Доставка осуществляется собственной службой доставки по адресу, указанному в заказе.",
  "Перед отправкой водитель свяжется с вами по указанному номеру.",
  "Доставка манипулятором доступна для тяжёлого оборудования — трансформаторов и генераторов. Если нужен кран, услуга согласовывается с менеджером и оплачивается заранее.",
  "Дату доставки можно перенести или скорректировать заказ, позвонив персональному менеджеру.",
];

const WARRANTY = [
  { title: "Гарантия производителя", text: "Срок зависит от товара и указан на его странице в каталоге." },
  { title: "Генераторы — 1 год", text: "С момента доставки или 1000 моточасов — что наступит раньше." },
  { title: "Возврат 14 дней", text: "Для товара надлежащего качества при сохранении упаковки." },
  { title: "Сервисный центр", text: "Гарантийное и сервисное обслуживание, монтаж и пусконаладка." },
];

const HELP_FAQ: FaqItem[] = [
  {
    q: "Как разместить заказ?",
    a: "Зарегистрируйтесь по номеру телефона, заполните корзину, укажите способ оплаты и отгрузки и нажмите «Оформить заказ». Персональный менеджер перезвонит для подтверждения.",
  },
  {
    q: "Где посмотреть список своих заказов?",
    a: "Статус и история заказов, сопроводительные документы и отчёт по задолженности доступны в личном кабинете в разделе «Заказы».",
  },
  {
    q: "Как работают персональные цены и кешбэк?",
    a: "Незарегистрированные пользователи видят прайсовые цены. После одобрения аккаунта менеджер назначает индивидуальную скидку и процент кешбэка — они могут отличаться по товарам, брендам и категориям. Кешбэк начисляется на бонусный счёт после оплаты заказа.",
  },
  {
    q: "Как выгрузить смету в Excel или поделиться корзиной?",
    a: "В корзине нажмите «Скачать смету» — файл формируется с кодами, наименованиями, количеством, ценами и скидками. Кнопка «Поделиться» создаёт ссылку: получатель увидит те же товары, а цены — соответствующие его аккаунту.",
  },
  {
    q: "Можно ли отменить или изменить заказ?",
    a: "Пока заказ не отгружен, его можно отменить или отредактировать в разделе «Заказы» личного кабинета. Изменения автоматически передаются вашему менеджеру.",
  },
  {
    q: "Предоставляет ли магазин рассрочку?",
    a: "Рассрочка оговаривается отдельно для каждого заказа с персональным менеджером.",
  },
  {
    q: "Есть ли у магазина сервисный центр?",
    a: "Технический отдел консультирует по выбору и установке оборудования, выполняет гарантийное и сервисное обслуживание, монтаж и пусконаладку. Стоимость работ рассчитает ваш персональный менеджер.",
  },
];

export default async function HelpPage() {
  const [help, delivery, payment] = await Promise.all([
    safe(publicGet<CmsPage | null>("/content/pages/help", undefined, 300), null),
    safe(publicGet<CmsPage | null>("/content/pages/delivery", undefined, 300), null),
    safe(publicGet<CmsPage | null>("/content/pages/payment", undefined, 300), null),
  ]);

  return (
    <div className="container-page pb-[64px] md:pb-[100px]">
      <PageHead crumbs={[{ label: "Покупателям" }]} title="Покупателям" />
      <AnchorTabs tabs={TABS} className="mt-[24px] md:mt-[28px]" />

      {/* Как купить */}
      <section id="how-to-buy" className="mt-[40px] scroll-mt-[130px] md:mt-[56px]">
        <SectionTitle>Как купить</SectionTitle>
        <Steps items={STEPS} className="mt-[28px] md:mt-[40px]" />
        <div className="mt-[40px] grid grid-cols-1 gap-[24px] md:mt-[56px] lg:grid-cols-[minmax(0,1fr)_417px] lg:gap-[60px]">
          {help ? <Prose html={help.body_html} /> : <div />}
          <div className="self-start rounded-[11px] bg-brand px-[24px] py-[28px] shadow-[0_2px_8px_2px_rgba(0,0,0,0.13)] md:px-[34px]">
            <h3 className="text-[20px] font-bold leading-[26px]">Персональные цены и кешбэк</h3>
            <p className="mt-[10px] text-[15px] leading-[23px] text-black">
              Зарегистрируйтесь — после одобрения менеджер назначит индивидуальную скидку, а с каждого заказа будут начисляться бонусы.
            </p>
            <div className="mt-[20px] flex flex-wrap gap-[10px]">
              <ButtonLink href="/register" variant="dark" className="px-[24px]">
                Зарегистрироваться
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" className="bg-white px-[24px] hover:bg-btn">
                Войти
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Доставка */}
      <section id="delivery" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
        <SectionTitle>Доставка</SectionTitle>
        <div className="mt-[20px] grid grid-cols-1 gap-[32px] md:mt-[24px] lg:grid-cols-[minmax(0,1fr)_417px] lg:gap-[60px]">
          <div>
            {delivery ? <Prose html={delivery.body_html} className="[&_em]:hidden" /> : null}
            <h3 className="mt-[28px] text-[18px] font-bold leading-[24px]">Время доставки</h3>
            <p className="mt-[10px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
              В течение 1 рабочего дня после согласования заявки с продавцом-консультантом. Заказы, согласованные после 14:00, могут быть доставлены на следующий день.
            </p>
            <h3 className="mt-[28px] text-[18px] font-bold leading-[24px]">Правила доставки</h3>
            <ul className="mt-[12px] flex flex-col gap-[8px] text-[15px] leading-[24px] text-g333 md:text-[16px] md:leading-[26px]">
              {DELIVERY_RULES.map((r) => (
                <li key={r} className="relative pl-[18px] before:absolute before:left-[4px] before:top-[11px] before:size-[5px] before:rounded-full before:bg-[#B3BAC7] before:content-['']">
                  {r}
                </li>
              ))}
            </ul>
            <Note title="Обратите внимание" className="mt-[28px]">
              Подъём на этаж и разгрузка товара не входят в услугу доставки (кроме доставки манипулятором).
            </Note>
          </div>
          <PriceCard
            title="Стоимость доставки"
            className="self-start"
            rows={[
              ["Душанбе, заказ от 1000 с.", "Бесплатно"],
              ["Душанбе, заказ до 1000 с.", "30 с."],
              ["Самовывоз со склада и из магазина", "Бесплатно"],
              ["За пределы Душанбе и Худжанда", "По договорённости"],
            ]}
          >
            <InfoPanel className="mt-[24px]" icon={<IconTruck className="size-[21px] shrink-0" />} title="Генераторы и трансформаторы">
              Доставка манипулятором, стоимость рассчитывает персональный менеджер.
            </InfoPanel>
            <p className="mt-[16px] text-[13px] leading-[20px] text-sub">Точную стоимость и время менеджер подтвердит при согласовании заказа.</p>
          </PriceCard>
        </div>
      </section>

      {/* Оплата */}
      <section id="payment" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
        <SectionTitle>Оплата</SectionTitle>
        <Lead className="mt-[12px]">Оплата производится в национальной валюте — сомони (TJS).</Lead>
        <div className="mt-[24px] grid grid-cols-1 gap-[13px] md:grid-cols-2 lg:grid-cols-3 lg:gap-[20px]">
          <div className="flex gap-[22px] rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:px-[34px] md:py-[28px]">
            <IconUserCircle className="size-[48px] shrink-0" />
            <div>
              <h3 className="text-[16px] font-bold leading-[20px]">Для физических лиц</h3>
              <p className="mt-[8px] text-[14px] leading-[20px] text-sub">Наличными или картой курьеру при доставке или при получении в наших магазинах. Онлайн-оплата картой при оформлении заказа.</p>
            </div>
          </div>
          <div className="flex gap-[22px] rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:px-[34px] md:py-[28px]">
            <IconCube className="size-[48px] shrink-0" />
            <div>
              <h3 className="text-[16px] font-bold leading-[20px]">Для юридических лиц</h3>
              <p className="mt-[8px] text-[14px] leading-[20px] text-sub">Банковским переводом по счёту. Счёт появится в разделе «Документы» личного кабинета, срок оплаты — 14 дней.</p>
            </div>
          </div>
          <div className="rounded-[8px] bg-surface-2 px-[24px] py-[24px] md:col-span-2 md:px-[34px] md:py-[28px] lg:col-span-1">
            <h3 className="text-[16px] font-bold leading-[20px]">Способы оплаты</h3>
            {payment ? <Prose html={payment.body_html} className="mt-[10px] text-[14px] leading-[20px] md:text-[14px] md:leading-[20px] [&_ul]:gap-[4px] [&_ul>li]:before:top-[8px]" /> : null}
          </div>
        </div>
      </section>

      {/* Гарантия */}
      <section id="warranty" className="mt-[56px] scroll-mt-[130px] md:mt-[90px]">
        <SectionTitle>Гарантия</SectionTitle>
        <Lead className="mt-[12px] max-w-[860px]">Продаём только оригинальную продукцию от официальных производителей — на все товары действует гарантия.</Lead>
        <div className="-mx-4 mt-[24px] bg-surface px-4 py-[32px] md:mx-0 md:mt-[28px] md:rounded-[11px] md:px-[34px] md:py-[36px]">
          <CheckPoints items={WARRANTY} />
        </div>
        <div className="mt-[20px] flex flex-col gap-[16px] rounded-[11px] border border-line px-[24px] py-[22px] md:flex-row md:items-center md:justify-between md:px-[34px]">
          <p className="text-[15px] leading-[24px] text-g333 md:text-[16px]">
            Гарантийный случай? Позвоните{" "}
            <a href={SITE.phoneHref} className="font-semibold text-black underline-offset-2 hover:underline">
              {SITE.phone}
            </a>{" "}
            или оставьте заявку в сервис центр.
          </p>
          <ButtonLink href="/services/obsluzhivanie-dgu-ibp" className="shrink-0 px-[24px]">
            Сервис центр ДГУ
          </ButtonLink>
        </div>
      </section>

      {/* Вопросы и ответы — как нижний блок «Сервис центр ДГУ»: аккордеон слева, форма справа */}
      <section id="faq" className="mt-[56px] grid scroll-mt-[130px] grid-cols-1 gap-[48px] md:mt-[90px] lg:grid-cols-2 lg:gap-[92px]">
        <div>
          <h2 className="text-[26px] font-bold leading-[32px] md:text-[32px] md:leading-[36px]">Вопросы и ответы</h2>
          <Faq items={HELP_FAQ} className="mt-[25px]" />
        </div>
        <div>
          <h2 className="text-[26px] font-bold leading-[32px] md:text-[32px] md:leading-[36px]">Не нашли ответ?</h2>
          <p className="mt-[14px] text-[16px] leading-[24px] text-g333 md:text-[18px]">Задайте вопрос, и наши специалисты свяжутся с вами.</p>
          <ContactForm messagePlaceholder="Ваш вопрос" submitLabel="Задать вопрос" className="mt-[25px]" />
        </div>
      </section>
    </div>
  );
}
