import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Roboto } from "next/font/google";
import "./globals.css";
import type { CategoryNode } from "@/lib/types";
import { publicGet, safe } from "@/lib/server";
import { AppInit } from "@/components/layout/AppInit";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/ui/Toaster";
import { NavProgress } from "@/components/layout/NavProgress";
import { SITE } from "@/lib/site";

// Figma tec.tj набран в Roboto (300/400/500/600/700/800) — variable font покрывает все начертания
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ТЭК — Точикэлектрокомплект: интернет-магазин электротехники",
    template: "%s — ТЭК",
  },
  description:
    "Кабели, кабеленесущие системы, светотехника, генераторы, щитовое оборудование. Доставка по Таджикистану за 48 часов. Персональные цены и кешбэк для электриков и закупщиков.",
  metadataBase: new URL(SITE.url),
};

export const viewport: Viewport = {
  themeColor: "#ffcc33",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // всё приложение рендерится по запросу: шапка и страницы берут живые данные из API (цены, остатки, каталог),
  // а при сборке образа API недоступен. Ответы API кешируются в Data Cache (publicGet → revalidate).
  await connection();
  const categories = await safe(publicGet<CategoryNode[]>("/catalog/tree", undefined, 120), []);
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={`${roboto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-[6px] focus:bg-white focus:px-4 focus:py-2 focus:text-[14px] focus:text-black focus:shadow-pop">
          Перейти к содержимому
        </a>
        <AppInit />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header categories={categories} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer categories={categories} />
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
