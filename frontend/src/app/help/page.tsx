import type { Metadata } from "next";
import { publicGet, safe } from "@/lib/server";
import { ButtonLink } from "@/components/ui/Button";
import { SectionTitle } from "@/components/content/PageHead";
import { Prose } from "@/components/content/Prose";
import { Steps } from "@/components/content/Blocks";
import type { CmsPage } from "@/components/content/types";

export const metadata: Metadata = {
  title: "Как купить?",
  description: "Как купить в ТЭК: поиск товара, корзина и смета, оформление заказа, персональные цены и кешбэк.",
};

const STEPS = [
  { title: "Найдите товар", text: "В каталоге или поиском по коду, наименованию и бренду." },
  { title: "Добавьте в корзину", text: "Укажите количество, сохраните смету в Excel или поделитесь корзиной." },
  { title: "Оформите заказ", text: "Выберите доставку или самовывоз и удобный способ оплаты." },
  { title: "Получите заказ", text: "Менеджер подтвердит заказ, доставим за 1 рабочий день." },
];

export default async function HowToBuyPage() {
  const help = await safe(publicGet<CmsPage | null>("/content/pages/help", undefined, 300), null);
  return (
    <section className="mt-[40px] md:mt-[56px]">
      <SectionTitle>Как купить?</SectionTitle>
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
  );
}
