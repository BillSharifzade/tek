"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/content/StatusScreen";
import { SITE } from "@/lib/site";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = /fetch failed|ECONNREFUSED|NetworkError|EAI_AGAIN/i.test(error.message);

  return (
    <StatusScreen
      code={offline ? "503" : "500"}
      title={offline ? "Сервер временно недоступен" : "Что-то пошло не так"}
      text={
        <>
          {offline ? "Не удалось получить данные с сервера. Попробуйте обновить страницу через минуту." : "Произошла ошибка при загрузке страницы. Попробуйте ещё раз."} Если ошибка повторяется — позвоните нам:{" "}
          <a href={SITE.phoneHref} className="font-semibold text-black underline-offset-2 hover:underline">
            {SITE.phone}
          </a>
          .
        </>
      }
      note={error.digest ? <p className="mt-[10px] text-[13px] leading-[18px] text-muted">Код ошибки: {error.digest}</p> : null}
      actions={
        <>
          <Button onClick={reset} size="lg" className="px-[24px]">
            Попробовать снова
          </Button>
          <ButtonLink href="/" size="lg" variant="secondary" className="px-[24px]">
            На главную
          </ButtonLink>
        </>
      }
    />
  );
}
