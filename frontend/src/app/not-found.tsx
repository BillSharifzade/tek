import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <span className="text-[96px] font-bold leading-none text-brand">404</span>
      <h1 className="mt-4">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-sub">Возможно, товар был перемещён или ссылка устарела. Воспользуйтесь поиском или перейдите в каталог.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">На главную</ButtonLink>
        <ButtonLink href="/catalog" variant="secondary">
          В каталог
        </ButtonLink>
      </div>
    </div>
  );
}
