"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = /fetch failed|ECONNREFUSED|NetworkError/i.test(error.message);

  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1>{offline ? "Сервер временно недоступен" : "Что-то пошло не так"}</h1>
      <p className="mt-2 max-w-md text-sub">
        {offline ? "Не удалось получить данные с сервера. Попробуйте обновить страницу через минуту." : "Произошла ошибка при загрузке страницы."}
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Код: {error.digest}</p> : null}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Попробовать снова</Button>
        <ButtonLink href="/" variant="secondary">
          На главную
        </ButtonLink>
      </div>
    </div>
  );
}
