import { ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/content/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Страница не найдена"
      text="Возможно, товар перемещён или ссылка устарела. Воспользуйтесь поиском по коду, наименованию или бренду либо перейдите в каталог."
      actions={
        <>
          <ButtonLink href="/catalog" size="lg" className="px-[24px]">
            Перейти в каталог
          </ButtonLink>
          <ButtonLink href="/" size="lg" variant="secondary" className="px-[24px]">
            На главную
          </ButtonLink>
        </>
      }
    />
  );
}
